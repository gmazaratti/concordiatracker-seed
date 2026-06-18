import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Mail, MailCheck } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { expiresInLabel, inviteStatus, maskEmail, type InviteStatus } from '@/data/teacher'
import { Button } from '@/components/ui/Button'

/** Accept an invitation — single-use, expiring, and tied to the recipient's email
 * (the confirmation step is stubbed). A valid invite creates a PENDING account and
 * signs the teacher in; invalid/expired/used tokens get a clear dead end. */
export function TeacherInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { getInvite, acceptInvite } = useTeacher()

  const invite = token ? getInvite(token) : undefined
  const status = inviteStatus(invite)

  if (status !== 'valid' || !invite) {
    return <InviteError status={status} />
  }

  function accept() {
    const acct = acceptInvite(invite!.token)
    if (acct) navigate('/teacher')
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <Mail size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight font-semibold text-fg">
          You've been invited
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          You've been invited to manage{' '}
          <strong className="text-fg">
            {invite.code} · Section {invite.section}
          </strong>{' '}
          ({invite.title}) as <strong className="text-fg">{invite.teacherName}</strong>.
        </p>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3">
          <MailCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-[12px] leading-relaxed text-subtle">
            Confirm it's you — we sent a code to{' '}
            <span className="font-medium text-fg">{maskEmail(invite.recipientEmail)}</span>. This
            invite link is single-use and {expiresInLabel(invite).toLowerCase()}.
          </p>
        </div>

        <Button className="mt-4 w-full" onClick={accept}>
          Confirm my email &amp; continue
        </Button>
        <p className="mt-2 text-center text-[11px] text-subtle">
          You'll start as <span className="text-warning">pending approval</span> until an admin
          approves you.
        </p>
      </div>
    </div>
  )
}

const REASON: Record<Exclude<InviteStatus, 'valid'>, string> = {
  expired: 'This invitation link has expired.',
  used: 'This invitation link has already been used.',
  notfound: "This invitation link isn't valid.",
}

function InviteError({ status }: { status: InviteStatus }) {
  const reason = status === 'valid' ? '' : REASON[status]
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-warning/15 text-warning">
          <AlertTriangle size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[20px] font-semibold text-fg">Invite unavailable</h1>
        <p className="mt-1.5 text-[13px] text-muted">{reason} Ask your admin for a new one.</p>
        <Link
          to="/teacher"
          className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Back to the portal
        </Link>
      </div>
    </div>
  )
}
