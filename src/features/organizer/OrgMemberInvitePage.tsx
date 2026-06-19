import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Loader2, Users } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

type Invite = { orgName: string; memberName: string; role: string }

/** `/organizer/join/:token` — accept a teammate invite to an org dashboard. Demo
 * orgs hold their invites in memory; a real org's invite lives in org_members and
 * is activated via a definer RPC (the invitee isn't the owner). */
export function OrgMemberInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { orgs, myOrg, acceptOrgMemberInvite } = useTeacher()
  const [busy, setBusy] = useState(false)

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
    void (async () => {
      const { data: rows } = await supabase
        .from('org_members')
        .select('name,role,org_id')
        .eq('invite_token', token)
        .limit(1)
      const row = rows?.[0] as { name: string | null; role: string; org_id: string } | undefined
      if (!row) {
        if (active) setDbInvite(null)
        return
      }
      const { data: orgRows } = await supabase.from('organizations').select('name').eq('id', row.org_id).limit(1)
      if (active) {
        setDbInvite({
          orgName: (orgRows?.[0] as { name: string } | undefined)?.name ?? 'this organization',
          memberName: row.name ?? 'you',
          role: row.role,
        })
      }
    })()
    return () => {
      active = false
    }
  }, [token, orgs, myOrg])

  const invite = memInvite ?? dbInvite

  async function accept() {
    if (!token) return
    setBusy(true)
    if (await acceptOrgMemberInvite(token)) navigate('/organizer')
    else setBusy(false)
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

        <Button className="mt-4 w-full" disabled={busy} onClick={accept}>
          {busy ? 'Joining…' : 'Accept & open dashboard'}
        </Button>
      </div>
    </div>
  )
}
