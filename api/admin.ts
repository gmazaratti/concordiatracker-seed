/**
 * GET /api/admin?action=… — the admin panel's server side.
 *
 *   ?action=stripe-user&email=…   one customer: subscription, invoices, charges
 *   ?action=stripe-rollup         the money, for the dashboard
 *   ?action=reconcile             what Stripe says vs what our tables say
 *   ?action=org-approved&id=…     tell an org its portal is live (POST)
 *
 * WHY A SERVER ROUTE AT ALL. The Stripe secret key can never reach a browser,
 * and the admin panel is a browser. Everything here is a read; nothing writes
 * to Stripe.
 *
 * WHY `is_admin()` AND NOT A ROLE CHECK IN HERE. The same definition the
 * database uses, asked of the database with the caller's own token, so an
 * admin list maintained in one place cannot disagree with a copy kept in
 * another. A non-admin gets 403 before a single Stripe call is made.
 */
import { stripeByEmail, stripeRollup, stripeMode } from './_stripe-admin.js'
import { fail } from './_respond.js'
import { sendEmail } from './_email.js'
import { extractOutline } from './_parse-core.js'

export const config = { maxDuration: 60 }

/** The caller's user id, read from a token `is_admin()` has already accepted. */
function jwtSub(jwt: string): string | null {
  try {
    const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(Buffer.from(part, 'base64').toString('utf8')) as { sub?: string }).sub ?? null
  } catch {
    return null
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !svcKey) {
    fail(res, 500, 'The admin API is not configured on this server.', { code: 'not_configured' })
    return
  }

  const auth: string = req.headers?.authorization ?? ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!jwt) {
    fail(res, 401, 'Sign in as an admin.')
    return
  }

  // Asked of the database, as the caller. A forged answer would need their
  // service role key, which is the same thing as having the database.
  const check = await fetch(`${url}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!check.ok || (await check.text()).trim() !== 'true') {
    fail(res, 403, 'Admins only.')
    return
  }

  const action = String(req.query?.action ?? '')
  try {
    if (action === 'stripe-user') {
      const email = String(req.query?.email ?? '').trim()
      if (!email) {
        fail(res, 400, 'Give an email.')
        return
      }
      const customer = await stripeByEmail(email)
      // A student who never paid is the common case, not an error.
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ mode: stripeMode(), customer })
      return
    }

    if (action === 'stripe-rollup') {
      const rollup = await stripeRollup()
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(rollup)
      return
    }

    /**
     * The reconciliation.
     *
     * Our billing columns are a cache the webhook writes, and the question
     * "are they right" cannot be answered by reading the cache. So this pulls
     * both and reports the DIFFERENCES — which is the only part worth looking
     * at, and the part that is invisible on every other screen.
     */
    if (action === 'reconcile') {
      const svc = { apikey: svcKey, Authorization: `Bearer ${svcKey}` }
      const [rollup, profilesRes] = await Promise.all([
        stripeRollup(),
        fetch(
          `${url}/rest/v1/user_profile?select=name,email,plan_status,subscription_status,stripe_customer_id,comped,is_internal`,
          { headers: svc },
        ),
      ])
      const profiles = (await profilesRes.json()) as {
        name: string | null
        email: string | null
        plan_status: string | null
        subscription_status: string | null
        stripe_customer_id: string | null
        comped: boolean | null
        is_internal: boolean | null
      }[]

      const paying = new Set(rollup.payingEmails.map((e) => e.toLowerCase()).filter(Boolean))
      const trialing = new Set(rollup.trialingEmails.map((e) => e.toLowerCase()).filter(Boolean))
      const mismatches: { email: string; name: string | null; stripe: string; ours: string }[] = []

      for (const p of profiles) {
        const email = (p.email ?? '').toLowerCase()
        if (!email || p.is_internal) continue
        const stripeSays = paying.has(email) ? 'paying' : trialing.has(email) ? 'trialing' : 'none'
        const oursSays =
          p.plan_status === 'pro' ? (p.comped ? 'pro (comped)' : 'pro') : 'free'

        // A comped Pro with nothing in Stripe is correct, not a mismatch --
        // that is exactly what the flag is for.
        const fine =
          (stripeSays === 'paying' && p.plan_status === 'pro') ||
          (stripeSays === 'trialing' && p.plan_status === 'pro') ||
          (stripeSays === 'none' && p.plan_status !== 'pro') ||
          (stripeSays === 'none' && p.comped)
        if (!fine) {
          mismatches.push({ email, name: p.name, stripe: stripeSays, ours: oursSays })
        }
      }

      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({
        mode: rollup.mode,
        checkedAt: new Date().toISOString(),
        stripe: {
          paying: rollup.payingEmails,
          trialing: rollup.trialingEmails,
          mrr: rollup.mrr,
          currency: rollup.currency,
          revenueTotal: rollup.revenueTotal,
        },
        ours: {
          pro: profiles.filter((p) => p.plan_status === 'pro' && !p.is_internal).length,
          comped: profiles.filter((p) => p.comped && !p.is_internal).length,
          internal: profiles.filter((p) => p.is_internal).length,
        },
        mismatches,
        notes: rollup.notes,
      })
      return
    }

    /**
     * Everything the Overview page draws, in ONE call.
     *
     * Money from Stripe, everything else from Postgres, merged here rather
     * than fetched separately by the page — three requests would mean three
     * snapshots, and a card that disagrees with the chart beside it is worse
     * than a slower page.
     */
    if (action === 'dashboard') {
      const days = Math.min(365, Math.max(7, Number(req.query?.days ?? 30)))
      const svc = { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json' }
      const rpc = async (fn: string, args: object) => {
        const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
          method: 'POST',
          // As the CALLER, so the is_admin() gate inside each function is the
          // one that decides — not a service key that bypasses it.
          headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        })
        return r.ok ? await r.json() : null
      }
      void svc

      const [rollup, series, counts, activity] = await Promise.all([
        stripeRollup().catch((e: unknown) => ({
          error: e instanceof Error ? e.message : 'Stripe did not answer.',
        })),
        rpc('admin_daily_series', { p_days: days }),
        rpc('admin_overview_counts', {}),
        rpc('admin_recent_activity', { p_limit: 25 }),
      ])
      // The operational counts the old Overview showed — pending applications,
      // open bugs, orgs awaiting approval. Folded in rather than left on a
      // second dashboard: two pages answering "how are we doing" is how you
      // end up checking neither.
      const ops = await rpc('admin_dashboard_stats', {})

      // Stripe's events are merged into the one feed, newest first, so the
      // money and the signups sit on a single timeline instead of two lists
      // you have to read against each other.
      const stripeRows = (rollup as { activity?: unknown[] }).activity ?? []
      const merged = [...((activity as unknown[]) ?? []), ...stripeRows]
        .filter((r): r is { at: string } => !!(r as { at?: string })?.at)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 60)

      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({
        days,
        generatedAt: new Date().toISOString(),
        // The timezone rule, stated rather than assumed: every bucket is a UTC
        // calendar day, so "today" ends at 00:00 UTC, not midnight in Montreal.
        timezone: 'UTC',
        stripe: rollup,
        series: series ?? [],
        counts: counts ?? {},
        ops: ops ?? {},
        activity: merged,
      })
      return
    }

    /*
     * AN APPROVAL NOBODY IS TOLD ABOUT IS NOT AN APPROVAL.
     * A club signs up, reads "pending", and hears nothing — so it never comes
     * back, and the approval we eventually clicked reaches an empty chair.
     * Fired by the admin console right after the status write. Best-effort,
     * like every other send: `sendEmail` never throws, and a bounced email
     * must not make a successful approval look failed.
     */
    if (action === 'org-approved') {
      const id = String(req.query?.id ?? '').trim()
      if (!id) {
        fail(res, 400, 'Which org? Pass ?id=<org id>.', { code: 'bad_request' })
        return
      }
      const svc = { apikey: svcKey, Authorization: `Bearer ${svcKey}` }
      const rows = await fetch(
        `${url}/rest/v1/organizations?id=eq.${encodeURIComponent(id)}&select=name,handle,owner_id,status`,
        { headers: svc },
      ).then((r) => r.json())
      const org = Array.isArray(rows) ? rows[0] : null
      if (!org) {
        fail(res, 404, 'No org with that id.', { code: 'not_found' })
        return
      }
      if (!org.owner_id) {
        // Seeded orgs have no owner and no one to write to. Not an error.
        res.status(200).json({ sent: false, reason: 'no_owner' })
        return
      }
      const prof = await fetch(
        `${url}/rest/v1/user_profile?user_id=eq.${org.owner_id}&select=email,name`,
        { headers: svc },
      ).then((r) => r.json())
      const to = Array.isArray(prof) && prof[0]?.email ? String(prof[0].email) : ''
      if (!to) {
        res.status(200).json({ sent: false, reason: 'no_email' })
        return
      }
      const site = process.env.PUBLIC_SITE_URL ?? 'https://concordiatracker.com'
      const sent = await sendEmail({
        to,
        subject: `${org.name} is live on ConcordiaTracker`,
        heading: `${org.name} is approved`,
        paragraphs: [
          `Your organizer portal is open. Anything you post now shows up in the Community feed that every ConcordiaTracker student sees.`,
          `Your public page is ${site}/app/community/org/${String(org.handle).replace(/^@/, '')} — share it anywhere.`,
        ],
        button: { label: 'Post your first event', href: `${site}/organizer` },
        footnote: 'Reply to this email if anything looks wrong and a person will read it.',
      })
      res.status(200).json({ sent })
      return
    }

    if (action === 'invite-email') {
      // A DIRECT club invite (db/direct_invites.sql), emailed. Everything in
      // the message is read back from the database by token — never taken
      // from the request — so what is sent is necessarily what was created,
      // and a revoked, used or link-only invite cannot be mailed.
      const token = String(req.query?.token ?? '').trim()
      if (!/^[0-9a-f]{20,64}$/i.test(token)) {
        fail(res, 400, 'Which invite? Pass ?token=<invite token>.', { code: 'bad_request' })
        return
      }
      const svc = { apikey: svcKey, Authorization: `Bearer ${svcKey}` }
      const rows = await fetch(
        `${url}/rest/v1/org_invites?token=eq.${token}&select=org_name,org_handle,kind,recipient_email,mode,expires_at,revoked_at,use_count,max_uses`,
        { headers: svc },
      ).then((r) => r.json())
      const inv = Array.isArray(rows) ? rows[0] : null
      if (!inv) {
        fail(res, 404, 'No invite with that token.', { code: 'not_found' })
        return
      }
      if (inv.kind === 'link' || !inv.recipient_email || inv.revoked_at || inv.use_count >= inv.max_uses) {
        res.status(200).json({ sent: false, reason: 'not_sendable' })
        return
      }
      const site = process.env.PUBLIC_SITE_URL ?? 'https://concordiatracker.com'
      const expires = new Date(inv.expires_at)
      const sent = await sendEmail({
        to: String(inv.recipient_email),
        subject: `You're invited to run ${inv.org_name} on ConcordiaTracker`,
        heading: `Set up ${inv.org_name}`,
        paragraphs: [
          inv.mode === 'prefilled'
            ? `We've built ${inv.org_name}'s page on ConcordiaTracker for you. Open the invite to review it, change anything, and make it yours.`
            : `You've been invited to set up ${inv.org_name} (${inv.org_handle}) on ConcordiaTracker — the app Concordia students use for their deadlines, events and clubs.`,
          `The invite is for you: sign in with this email address (${inv.recipient_email}) to accept it.`,
        ],
        button: { label: 'Open the invite', href: `${site}/join/${token}` },
        facts: expires.getFullYear() < 2099
          ? [{ label: 'Expires', value: expires.toLocaleDateString('en-CA', { dateStyle: 'long' }) }]
          : undefined,
        footnote: 'Not expecting this? You can ignore it — nothing happens unless you accept.',
      })
      res.status(200).json({ sent })
      return
    }

    /**
     * Re-run a failed syllabus parse on the file the student uploaded.
     *
     * Only failed uploads are kept (30 days, private bucket), so this can only
     * ever be asked about a failure. The result is NOT written into anybody's
     * courses: it is stored on the parse and the student is notified with a
     * link to review it, because adding assessments to a student's list is
     * their decision, not an admin's.
     */
    if (action === 'parse-retry') {
      const id = String(req.query?.id ?? '').trim()
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        fail(res, 400, 'Which parse? Pass ?id=<parse event id>.', { code: 'bad_request' })
        return
      }
      const svc = { apikey: svcKey, Authorization: `Bearer ${svcKey}` }
      const rows = await fetch(
        `${url}/rest/v1/parse_events?id=eq.${id}&select=id,user_id,file_path,file_name,success`,
        { headers: svc },
      ).then((r) => r.json())
      const ev = Array.isArray(rows) ? rows[0] : null
      if (!ev) {
        fail(res, 404, 'No parse with that id.', { code: 'not_found' })
        return
      }
      if (!ev.file_path) {
        fail(res, 409, 'That upload was not kept, so there is nothing to retry.', {
          code: 'conflict',
          hint: 'Only failed uploads since the retry feature shipped are kept, for 30 days.',
        })
        return
      }
      const file = await fetch(`${url}/storage/v1/object/parse-failures/${ev.file_path}`, { headers: svc })
      if (!file.ok) {
        fail(res, 404, 'The stored file could not be read. It may have been cleaned up.', { code: 'not_found' })
        return
      }
      const buf = await file.arrayBuffer()
      const started = Date.now()
      const parsed = await extractOutline(buf, 'application/pdf')
      const adminId = jwtSub(jwt)
      const ok = parsed.ok && parsed.assessments.length > 0
      await fetch(`${url}/rest/v1/parse_events?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...svc, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          retry_status: ok ? 'succeeded' : 'failed',
          retry_error: ok
            ? null
            : parsed.ok
              ? 'Read the file but found no assessments.'
              : (parsed.detail ?? parsed.failure ?? 'unknown').slice(0, 400),
          retry_result: ok
            ? { course: parsed.course, assessments: parsed.assessments, warnings: parsed.warnings ?? [] }
            : null,
          retried_at: new Date().toISOString(),
          retried_by: adminId,
        }),
      })
      if (ok) {
        const code = parsed.course?.code ? ` (${parsed.course.code})` : ''
        const n = parsed.assessments.length
        await fetch(`${url}/rest/v1/rpc/ct_notify`, {
          method: 'POST',
          headers: { ...svc, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_users: [ev.user_id],
            p_kind: 'parse_retry',
            p_title: 'Your syllabus is ready to review',
            p_body: `We re-read ${ev.file_name || 'the syllabus you uploaded'}${code} and found ${n} assessment${n === 1 ? '' : 's'}. Check them before adding.`,
            p_link: `/app/courses/upload?retry=${id}`,
            p_subject: null,
            p_actor: 'ConcordiaTracker',
          }),
        })
      }
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({
        ok,
        items: parsed.ok ? parsed.assessments.length : 0,
        course: parsed.ok ? parsed.course?.code ?? null : null,
        path: parsed.how,
        duration_ms: Date.now() - started,
        error: ok ? null : parsed.ok ? 'no assessments found' : parsed.detail ?? parsed.failure,
        notified: ok,
      })
      return
    }

    fail(res, 400, 'Unknown action.', {
      hint: 'stripe-user | stripe-rollup | reconcile | dashboard | parse-retry',
    })
  } catch (e) {
    // Stripe's own message is the useful one here; the caller is an admin.
    fail(res, 502, e instanceof Error ? e.message : 'Stripe did not answer.', {
      code: 'upstream_error',
    })
  }
}
