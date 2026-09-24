import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Loader2, Users } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { rememberReturn } from '@/lib/auth-intent'
import { declineMemberInvite, memberInviteInfo } from '@/lib/org-invites'
import { Button } from '@/components/ui/Button'

type Invite = { orgName: string; memberName: string; role: string; forYou?: boolean; bound?: boolean }

/** `/organizer/join/:token` — accept a teammate invite to an org dashboard. Demo
 * orgs hold their invites in memory; a real org's invite lives in org_members and
 * is activated via a definer RPC (the invitee isn't the owner). */
export function OrgMemberInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { orgs, myOrg, acceptOrgMemberInvite } = useTeacher()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [declined, setDeclined] = useState(false)

  // In-memory invites (demo orgs + your own org) resolve synchronously in render.
  let memInvite: Invite | null = null
  if (token) {
    for (const o of [...orgs, ...(myOrg ? [myOrg] : [])]) {
      const m = o.members.find((mm) => mm.inviteToken === token)
      if (m) {
        memInvite = { orgName: o.org.name, memberName: m.name, role: m.role }
        break
      }
    }
  }

  // Otherwise look it up in org_members by token (a real, cross-user invite).
  const [dbInvite, setDbInvite] = useState<Invite | null | undefined>(undefined)
  useEffect(() => {
    if (!token) return
    const inMem = [...orgs, ...(myOrg ? [myOrg] : [])].some((o) =>
      o.members.some((m) => m.inviteToken === token),
    )
    if (inMem) return
    let active = true
    // Through a definer function: it reports whether the invite was made for
    // THIS account, which a plain read of the row could not say.
    void memberInviteInfo(token).then((info) => {
      if (!active) return
      setDbInvite(
        info
          ? { orgName: info.orgName, memberName: info.memberName, role: info.roleName, forYou: info.forYou, bound: info.bound }
          : null,
      )
    })
    return () => {
      active = false
    }
  }, [token, orgs, myOrg, user])

  const invite = memInvite ?? dbInvite

  async function accept() {
    if (!token) return
    setBusy(true)
    const orgId = await acceptOrgMemberInvite(token)
    if (!orgId) {
      setBusy(false)
      return
    }
    // A full load, carrying WHICH club: the portal's list of your clubs was
    // read before you joined this one, and an admin has every club in it.
    if (memInvite) navigate('/organizer')
    else window.location.assign(`/organizer?org=${orgId}`)
  }

  async function decline() {
    if (!token) return
    setBusy(true)
    if (await declineMemberInvite(token)) setDeclined(true)
    setBusy(false)
  }

  function signIn() {
    if (!token) return
    // Every sign-in ends on /app; this brings the invitee back here after.
    rememberReturn(`/organizer/join/${token}`)
    navigate('/app')
  }

  if (invite === undefined) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  if (!invite) {
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <Users size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight font-semibold text-fg">
          Join {invite.orgName}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          You've been invited to help manage <strong className="text-fg">{invite.orgName}</strong>'s
          events and profile as <strong className="text-fg">{invite.role}</strong>.
        </p>
        <p className="mt-2 text-[12px] text-subtle">Invited as {invite.memberName}</p>

        {declined ? (
          <p role="status" className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
            Invite declined. The club can invite you again later.
          </p>
        ) : !user && !memInvite ? (
          <Button className="mt-4 w-full" onClick={signIn}>
            Sign in to accept
          </Button>
        ) : invite.bound && !invite.forYou ? (
          <p role="alert" className="mt-4 rounded-lg bg-warning/10 px-3 py-2.5 text-[13px] text-warning">
            This invite was sent to a different account. Sign in as the person it was meant for.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:flex-1" disabled={busy} onClick={accept}>
              {busy ? 'Joining…' : 'Accept & open dashboard'}
            </Button>
            {invite.forYou && (
              <Button variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={decline}>
                Decline
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
