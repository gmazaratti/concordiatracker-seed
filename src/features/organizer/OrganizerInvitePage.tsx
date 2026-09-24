import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CircleCheck, Loader2, MailCheck } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { supabase, fireWrite } from '@/lib/supabase'
import { expiresInLabel, inviteStatus, maskEmail, type InviteStatus } from '@/data/teacher'
import { Button } from '@/components/ui/Button'
import { AppleGlyph } from '@/components/AppleGlyph'
import { GoogleGlyph } from '@/components/GoogleGlyph'
import { rememberReturn } from '@/lib/auth-intent'
import { TutorialHint } from '@/components/TutorialHint'

interface DbInvite {
  org_name: string
  org_handle: string
  recipient_email: string | null
  status: 'valid' | 'used' | 'expired' | 'revoked'
  /** 'email' / 'user' = sent to one person; only they can accept. */
  kind?: 'link' | 'email' | 'user'
  /** 'prefilled' = an admin built the club; 'self' = you set it up. */
  mode?: 'self' | 'prefilled'
  /** Already claimed once: a further use joins that club's team. */
  claimed?: boolean
}

/** Accept an ORGANIZER invitation. Real invites (org_invites table) are
 * single-use + expiring + revocable, enforced server-side: view the invite
 * signed-out, sign in with Google right here, accept → a PENDING org is created
 * and onboarding starts. Legacy demo tokens (in-memory / self-contained oi_)
 * keep working for the seed flows. */
export function OrganizerInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { getOrgInvite, acceptOrgInvite } = useTeacher()
  const { user: authUser, signInWithGoogle, signInWithApple } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [dryRun, setDryRun] = useState(false)
  // undefined = loading, null = not found in the DB
  const [dbInvite, setDbInvite] = useState<DbInvite | null | undefined>(undefined)

  // Legacy paths resolve synchronously; only miss → ask the DB.
  const legacy = token ? getOrgInvite(token) : undefined

  // Tell the admin the link was OPENED — once while signed out, and again once
  // signed in (so their email is captured), but not repeatedly. Only for real,
  // still-valid DB invites (legacy/demo tokens have no row to update).
  const openedFor = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!token || legacy) return
    if (dbInvite?.status !== 'valid') return
    const key = authUser?.id ?? 'anon'
    if (openedFor.current.has(key)) return
    openedFor.current.add(key)
    let visitor: string | null = null
    try {
      visitor = localStorage.getItem('ct_vid')
    } catch {
      /* no storage: the open is still recorded, just not per browser */
    }
    fireWrite(supabase.rpc('record_org_invite_open', { p_token: token, p_visitor: visitor }))
  }, [token, legacy, dbInvite, authUser?.id])

  useEffect(() => {
    // Legacy tokens resolve synchronously in render; nothing to fetch.
    if (!token || legacy) return
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('get_org_invite', { p_token: token })
      if (!active) return
      const row = (data as DbInvite[] | null)?.[0]
      setDbInvite(row ?? null)
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // ── Legacy (demo) invites — unchanged flow ─────────────────────────────────
  if (legacy) {
    const status = inviteStatus(legacy)
    if (status !== 'valid') return <InviteError reason={REASON[status as Exclude<InviteStatus, 'valid'>]} />
    return (
      <InviteCard
        orgName={legacy.orgName}
        orgHandle={legacy.orgHandle}
        note={`Confirm it's you: we sent a code to ${maskEmail(legacy.recipientEmail)}. This invite link is single-use and ${expiresInLabel(legacy).toLowerCase()}.`}
        busy={busy}
        err={err}
        cta="Confirm & set up my dashboard"
        onAccept={async () => {
          setErr('')
          setBusy(true)
          const acct = await acceptOrgInvite(legacy.token)
          if (acct) {
            navigate('/organizer')
            return
          }
          setBusy(false)
          setErr("Couldn't set this up: you may already manage an org on this account.")
        }}
      />
    )
  }

  if (!token) return <InviteError reason={REASON.notfound} />
  if (dbInvite === undefined) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading invite" />
      </div>
    )
  }
  if (dbInvite === null) return <InviteError reason={REASON.notfound} />
  if (dbInvite.status !== 'valid')
    return <InviteError reason={REASON[dbInvite.status]} />

  // ── Real invite ────────────────────────────────────────────────────────────
  /**
   * `force` is the admin's way through their own safety net.
   *
   * An admin accept is a DRY RUN by default so that opening a club's link to
   * check it does not burn it. That is right, and it is also why the button
   * looked dead to the founder: it verified the link and stopped. Forcing is
   * a second, deliberate press that says set it up on this account — and it
   * consumes the link, which the button says out loud.
   */
  async function accept(force = false) {
    setErr('')
    setBusy(true)
    const { data, error } = await supabase.rpc('accept_org_invite', {
      p_token: token,
      p_force: force,
    })
    if (error || data == null) {
      setBusy(false)
      setErr(error?.message ?? "Couldn't accept this invite.")
      return
    }
    const res = data as { org_id?: string | null; dry_run?: boolean } | string
    if (typeof res === 'object' && res.dry_run) {
      setBusy(false)
      setDryRun(true)
      return
    }
    /*
     * A FULL LOAD, not a navigate: the org lives in a provider that read its
     * data before this account had one. And it lands on SETUP rather than the
     * dashboard — a club that has just accepted has a name and nothing else,
     * and a dashboard full of empty panels is a worse first screen than three
     * questions.
     */
    // Carry WHICH org: a platform admin has every organisation in the
    // switcher, so without this the portal opens on whichever sorted first.
    const id = typeof res === 'object' && res.org_id ? res.org_id : null
    window.location.assign(id ? `/organizer?org=${id}` : '/organizer')
  }

  /*
   * EVERY SIGN-IN ROUTE COMES BACK HERE. Each one ends somewhere fixed (OAuth
   * on /app, the email form on /app), so the path is recorded first and
   * AuthIntentRedirect returns to it once a session exists. Without this a
   * new account landed in the student app and the invite was gone.
   */
  const here = `/join/${token}`
  const viaGoogle = () => {
    rememberReturn(here)
    void signInWithGoogle()
  }
  const viaApple = () => {
    rememberReturn(here)
    void signInWithApple()
  }
  const viaEmail = () => {
    rememberReturn(here)
    navigate('/app')
  }

  const mode = dbInvite.mode ?? 'self'
  const joining = !!dbInvite.claimed
  const what = joining
    ? `join ${dbInvite.org_name}'s team`
    : mode === 'prefilled'
      ? `take over ${dbInvite.org_name}: we've set up its profile, and you review and edit everything before it's yours`
      : `set up ${dbInvite.org_name} from scratch: your profile, first event and team`

  return (
    <InviteCard
      orgName={dbInvite.org_name}
      orgHandle={dbInvite.org_handle}
      note={
        authUser
          ? `You're signed in as ${authUser.email}. Accepting lets you ${what}.`
          : `Sign in or create an account first. The club will be tied to it. Then you'll ${what}.${
              dbInvite.kind === 'email'
                ? ' This invite was sent to one email address: sign in with that one.'
                : dbInvite.kind === 'user'
                  ? ' This invite was sent to your account: sign in as you.'
                  : ''
            }`
      }
      busy={busy}
      err={err}
      success={
        dryRun
          ? 'Link verified (admin test run). Nothing was consumed; this exact link still works for the recipient.'
          : undefined
      }
      cta={joining ? 'Join the team' : mode === 'prefilled' ? 'Review & take over' : 'Start setting up'}
      onAccept={() => void accept(false)}
      signIn={authUser ? undefined : { google: viaGoogle, apple: viaApple, email: viaEmail }}
      footnote={
        joining
          ? 'You will join as a Member. The owner can change your role.'
          : mode === 'prefilled'
            ? 'A short guided review follows, so you can change anything before students see it.'
            : "You'll start as pending approval: a guided setup walks you through your profile, first event, and team."
      }
      onForce={dryRun ? () => void accept(true) : undefined}
    />
  )
}

function InviteCard({
  orgName,
  orgHandle,
  note,
  busy,
  err,
  success,
  cta,
  onAccept,
  onForce,
  signIn,
  footnote,
}: {
  orgName: string
  orgHandle: string
  note: string
  busy: boolean
  err: string
  success?: string
  cta: string
  onAccept: () => void
  /** Present only after a dry run, for the admin who meant it. */
  onForce?: () => void
  /** Signed out: every way in, each of which comes back to this page. */
  signIn?: { google: () => void; apple: () => void; email: () => void }
  footnote?: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <CalendarDays size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight font-semibold text-fg">
          You've been invited
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          You've been invited to manage the Community profile and events for{' '}
          <strong className="text-fg">{orgName}</strong>{' '}
          <span className="text-subtle">({orgHandle})</span> on ConcordiaTracker.
        </p>
        <TutorialHint id="invite-accept" className="mt-3" />

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3">
          <MailCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-[12px] leading-relaxed text-subtle">{note}</p>
        </div>

        {signIn ? (
          <div className="mt-4 flex flex-col gap-2">
            <Button size="lg" className="w-full" onClick={signIn.google}>
              <GoogleGlyph />
              Continue with Google
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={signIn.apple}>
              <AppleGlyph />
              Continue with Apple
            </Button>
            <button
              type="button"
              onClick={signIn.email}
              className="rounded-lg py-2 text-[13px] font-medium text-accent hover:underline"
            >
              Use email instead to sign in or create an account
            </button>
          </div>
        ) : (
          <Button className="mt-4 w-full" onClick={onAccept} disabled={busy || !!success}>
            {busy ? 'Setting up…' : cta}
          </Button>
        )}
        {success ? (
          <>
            {/* A STATUS GLYPH, not a tick. The character "✓" rendered in the
                font's own weight and sat off the baseline; a bare `Check` then
                read as a stray mark beside the sentence. `CircleCheck` is the
                shape this app uses everywhere else for "that worked". */}
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-success">
              <CircleCheck size={15} className="mt-px shrink-0" aria-hidden />
              <span>{success}</span>
            </p>
            {onForce && (
              <button
                type="button"
                onClick={onForce}
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                Set it up on this account anyway
                <span className="mt-0.5 block text-[11px] font-normal text-subtle">
                  Walks the real flow. This uses the link up.
                </span>
              </button>
            )}
          </>
        ) : err ? (
          <p className="mt-2 text-center text-[12px] text-danger">{err}</p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-subtle">
            {footnote ??
              "You'll start as pending approval: a guided setup walks you through your profile, first event, and team."}
          </p>
        )}
      </div>
    </div>
  )
}

const REASON: Record<'expired' | 'used' | 'notfound' | 'revoked', string> = {
  revoked: 'This invitation was cancelled.',
  expired: 'This invitation link has expired.',
  used: 'This invitation link has already been used.',
  notfound: "This invitation link isn't valid.",
}

function InviteError({ reason }: { reason: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-warning/15 text-warning">
          <AlertTriangle size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[20px] font-semibold text-fg">Invite unavailable</h1>
        <p className="mt-1.5 text-[13px] text-muted">{reason} Ask your admin for a new one.</p>
        <Link
          to="/organizer"
          className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Back to the portal
        </Link>
      </div>
    </div>
  )
}
