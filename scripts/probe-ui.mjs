/**
 * A throwaway account + org to look at the UI with, and the session payload to
 * paste into localStorage. Swept afterwards by `--clean`.
 *
 * Nothing here touches a real row: every account is `ct-probe-ui-…@example.com`
 * and `is_internal`, so it is not counted as a user and does not page the admin.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const URL_ = env.VITE_SUPABASE_URL
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const PREFIX = 'ct-probe-ui-'

if (process.argv.includes('--clean')) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  let n = 0
  for (const u of data?.users ?? []) {
    if (!u.email?.startsWith(PREFIX)) continue
    const { data: orgs } = await admin.from('organizations').select('id').eq('owner_id', u.id)
    for (const o of orgs ?? []) {
      await admin.from('org_posts').delete().eq('org_id', o.id)
      await admin.from('org_members').delete().eq('org_id', o.id)
      await admin.from('organizations').delete().eq('id', o.id)
    }
    await admin.from('user_profile').delete().eq('user_id', u.id)
    await admin.auth.admin.deleteUser(u.id)
    n++
  }
  const { count } = await admin
    .from('user_profile')
    .select('user_id', { count: 'exact', head: true })
  console.log(`removed ${n} probe accounts · ${count} profiles remain`)
  process.exit(0)
}

const rnd = Math.random().toString(36).slice(2, 8)
const email = `${PREFIX}${rnd}@example.com`
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email,
  password: 'Probe-' + rnd + '!9A',
  email_confirm: true,
})
if (cErr) throw cErr
const uid = created.user.id

const { error: pErr } = await admin.from('user_profile').upsert(
  {
    user_id: uid,
    email,
    name: 'Probe Student',
    handle: `probe${rnd}`,
    is_internal: true,
    onboarding_completed: true,
    profile_public: true,
    bio: 'Second-year software engineering. Building things that should have existed.',
    links: {
      website: 'https://linktr.ee/probe',
      instagram: '@probe.student',
      x: 'probe_s',
    },
  },
  { onConflict: 'user_id' },
)
// Loudly: a silent upsert that hits an unknown column leaves the probe on the
// onboarding gate and looks like an auth problem.
if (pErr) throw pErr

// An org with FOUR links and titles on two of them, so the row, the sheet and
// the fallback-to-host path are all on screen at once.
const { data: org, error: oErr } = await admin
  .from('organizations')
  .insert({
    owner_id: uid,
    handle: `@probeclub${rnd}`,
    name: 'Probe Robotics Society',
    bio: 'We build robots in the basement of EV and occasionally they work.',
    color: '#1f4e8c',
    glyph: 'PR',
    verified: true,
    status: 'approved',
    links: {
      website: 'https://linktr.ee/proberobotics',
      instagram: 'https://instagram.com/proberobotics',
      linkedin: 'https://linkedin.com/company/proberobotics',
      tiktok: 'https://tiktok.com/@proberobotics',
      titles: { website: 'All our links', instagram: 'Follow the builds' },
    },
  })
  .select('id, handle')
  .single()
if (oErr) throw oErr

await admin.from('org_members').insert({
  org_id: org.id,
  user_id: uid,
  role: 'owner',
  status: 'active',
})

const pic = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`
const { data: post } = await admin
  .from('org_posts')
  .insert({
    org_id: org.id,
    caption:
      'Three shots from build night. Swipe for the arm, the controller and the bit that caught fire. This caption is deliberately long so the collapsed row truncates and the tap-to-expand can be checked.',
    media: [
      { url: pic('probe-a', 1080, 1080), kind: 'image', w: 1080, h: 1080 },
      { url: pic('probe-b', 1080, 1080), kind: 'image', w: 1080, h: 1080 },
      { url: pic('probe-c', 1080, 1080), kind: 'image', w: 1080, h: 1080 },
    ],
  })
  .select('id')
  .single()

// A session, minted without a password prompt: generate_link makes the token,
// verify redeems it. Nothing is emailed.
const link = await fetch(`${URL_}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ type: 'magiclink', email }),
}).then((r) => r.json())

const session = await fetch(`${URL_}/auth/v1/verify`, {
  method: 'POST',
  headers: {
    apikey: env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  },
  // `token_hash`, not `token`: with a bare token GoTrue demands the email
  // alongside it and refuses the call.
  body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }),
}).then((r) => r.json())

const ref = new URL(URL_).hostname.split('.')[0]
console.log(
  JSON.stringify(
    {
      email,
      uid,
      handle: `probe${rnd}`,
      org: org.handle,
      postId: post?.id,
      storageKey: `sb-${ref}-auth-token`,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: 'bearer',
        user: session.user,
      },
    },
    null,
    0,
  ),
)
