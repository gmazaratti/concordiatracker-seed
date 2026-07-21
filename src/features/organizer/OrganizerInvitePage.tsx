import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Loader2, MailCheck } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { expiresInLabel, inviteStatus, maskEmail, type InviteStatus } from '@/data/teacher'
import { Button } from '@/components/ui/Button'

interface DbInvite {
  org_name: string
  org_handle: string
  recipient_email: string | null
  status: 'valid' | 'used' | 'expired'
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
  const { user: authUser, signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // undefined = loading, null = not found in the DB
  const [dbInvite, setDbInvite] = useState<DbInvite | null | undefined>(undefined)

  // Legacy paths resolve synchronously; only miss → ask the DB.
  const legacy = token ? getOrgInvite(token) : undefined

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
        note={`Confirm it's you — we sent a code to ${maskEmail(legacy.recipientEmail)}. This invite link is single-use and ${expiresInLabel(legacy).toLowerCase()}.`}
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
          setErr("Couldn't set this up — you may already manage an org on this account.")
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
  async function accept() {
    setErr('')
    setBusy(true)
    const { data, error } = await supabase.rpc('accept_org_invite', { p_token: token })
    if (error || !data) {
      setBusy(false)
      setErr(error?.message ?? "Couldn't accept this invite.")
      return
    }
    // Full reload so the provider picks up the freshly-created org, then the
    // onboarding wizard runs (fresh pending org).
    window.location.assign('/organizer')
  }

  return (
    <InviteCard
      orgName={dbInvite.org_name}
      orgHandle={dbInvite.org_handle}
      note={
        authUser
          ? `You're signed in as ${authUser.email} — accepting creates ${dbInvite.org_name}'s dashboard on this account. The link is single-use.`
          : 'Sign in with your Google account first — your org dashboard will be tied to it. The link is single-use.'
      }
      busy={busy}
      err={err}
      cta={authUser ? 'Accept & set up my dashboard' : 'Sign in with Google to continue'}
      onAccept={authUser ? accept : () => void signInWithGoogle()}
    />
  )
}

function InviteCard({
  orgName,
  orgHandle,
  note,
  busy,
  err,
  cta,
  onAccept,
}: {
  orgName: string
  orgHandle: string
  note: string
  busy: boolean
  err: string
  cta: string
  onAccept: () => void
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

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3">
          <MailCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-[12px] leading-relaxed text-subtle">{note}</p>
        </div>

        <Button className="mt-4 w-full" onClick={onAccept} disabled={busy}>
          {busy ? 'Setting up…' : cta}
        </Button>
        {err ? (
          <p className="mt-2 text-center text-[12px] text-danger">{err}</p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-subtle">
            You'll start as <span className="text-warning">pending approval</span> — a guided setup
            walks you through your profile, first event, and team.
          </p>
        )}
      </div>
    </div>
  )
}

const REASON: Record<'expired' | 'used' | 'notfound', string> = {
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
