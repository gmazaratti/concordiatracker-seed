import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Users } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { Button } from '@/components/ui/Button'

/** `/organizer/join/:token` — accept a teammate invite to an org dashboard. The
 * inviter pre-filled name/email/role; accepting just activates the member and
 * signs into that org (mock: there's no separate per-user identity yet). */
export function OrgMemberInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { orgs, acceptOrgMemberInvite } = useTeacher()

  const org = token ? orgs.find((o) => o.members.some((m) => m.inviteToken === token)) : undefined
  const member = org?.members.find((m) => m.inviteToken === token)

  if (!org || !member) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-warning/15 text-warning">
            <AlertTriangle size={22} aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-[20px] font-semibold text-fg">Invite unavailable</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            This invite link isn't valid or has already been used.
          </p>
          <Link
            to="/organizer"
            className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            Go to the portal
          </Link>
        </div>
      </div>
    )
  }

  function accept() {
    if (acceptOrgMemberInvite(token!)) navigate('/organizer')
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <Users size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight font-semibold text-fg">
          Join {org.org.name}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          You've been invited to help manage <strong className="text-fg">{org.org.name}</strong>'s
          events and profile as <strong className="text-fg">{member.role}</strong>.
        </p>
        <p className="mt-2 text-[12px] text-subtle">
          Invited as {member.name} · {member.email}
        </p>

        <Button className="mt-4 w-full" onClick={accept}>
          Accept &amp; open dashboard
        </Button>
      </div>
    </div>
  )
}
