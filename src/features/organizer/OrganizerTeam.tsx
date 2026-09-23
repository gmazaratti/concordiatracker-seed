import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Activity, Check, ChevronRight, Copy, Lock, UserPlus } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { supabase } from '@/lib/supabase'
import type { OrgMember, OrgRole } from '@/data/teacher'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { roleIdOf, setMemberRole, type OrgRoleDef } from '@/lib/org-roles'
import { isDemoOrgId } from '@/lib/demo-org'
import { cn } from '@/lib/cn'
import { MemberAvatar } from './MemberAvatar'
import { RoleChip } from './RoleChip'
import { useOrgRoles } from './use-org-roles'
import { useMemberPanel } from './member-panel/member-panel'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

function joinedLabel(days: number): string {
  if (days <= 0) return 'Joined today'
  if (days === 1) return 'Joined yesterday'
  if (days < 30) return `Joined ${days}d ago`
  if (days < 365) return `Joined ${Math.floor(days / 30)}mo ago`
  return `Joined ${Math.floor(days / 365)}y ago`
}

/** The legacy column, kept in step with the role for its older readers. */
function legacyFor(r: OrgRoleDef): OrgRole {
  return r.isOwner ? 'owner' : r.position >= 50 ? 'admin' : 'member'
}

/**
 * `/organizer/team` — who is on the team, and inviting more.
 *
 * EVERY ROW OPENS THE PERSON. Their role, ownership and removal live in the
 * member panel, which only offers what would succeed; the old per-person
 * permission switches are gone, because a permission is a property of a ROLE
 * and the team table now refuses a direct override from anybody but an owner
 * (db/org_member_guard.sql).
 */
export function OrganizerTeam() {
  const { currentOrg, isDemoSession, orgPerms, inviteOrgMember, refreshOrgs } = useTeacher()
  const { roles, mine } = useOrgRoles(currentOrg?.id)
  const { openMember } = useMemberPanel()
  if (!currentOrg) return <Navigate to="/organizer" replace />
  const orgId = currentOrg.id
  const canInvite = !!orgPerms?.manage_team || !!orgPerms?.is_owner

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">Team</h1>
      <p className="text-[13px] text-subtle">Who can run this club's portal. Tap anyone to see or change what they hold.</p>

      {canInvite && roles && (
        <InviteForm
          roles={roles}
          mine={mine}
          onInvite={(input, role) => {
            const m = inviteOrgMember({ ...input, role: legacyFor(role), roleId: isDemoOrgId(orgId) ? undefined : role.id })
            if (isDemoOrgId(orgId)) void setMemberRole(m.id, role.id).then(refreshOrgs)
            return m.inviteToken ?? null
          }}
        />
      )}

      <h2 className="mt-6 mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        With access · {currentOrg.members.length}
      </h2>
      <ul className="flex flex-col gap-2">
        {currentOrg.members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            role={roles?.find((r) => r.id === roleIdOf(m, orgId, roles))}
            onOpen={() => openMember({ memberId: m.id })}
          />
        ))}
      </ul>

      <ActivityTrail orgId={orgId} real={!isDemoSession} onActor={(userId, name) => openMember({ userId, name })} />
    </div>
  )
}

function InviteForm({
  roles,
  mine,
  onInvite,
}: {
  roles: OrgRoleDef[]
  mine: number
  onInvite: (input: { name: string; email: string }, role: OrgRoleDef) => string | null
}) {
  // Only roles strictly below yours: the database refuses anything else, so
  // the list is shorter rather than the error longer.
  const grantable = useMemo(() => roles.filter((r) => r.position < mine && !r.isOwner), [roles, mine])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const chosen = grantable.find((r) => r.id === roleId) ?? grantable.find((r) => r.systemKey === 'member') ?? grantable.at(-1)

  if (grantable.length === 0) return null

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        <UserPlus size={15} className="text-accent" aria-hidden />
        Invite a teammate
      </h2>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-[12px] font-medium text-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={field} />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[12px] font-medium text-muted">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="them@club.ca" className={field} />
        </label>
        <label className="sm:w-44">
          <span className="mb-1 block text-[12px] font-medium text-muted">Role</span>
          <Select
            ariaLabel="Role"
            value={chosen?.id ?? ''}
            onChange={setRoleId}
            options={grantable.map((r) => ({ value: r.id, label: r.name }))}
          />
        </label>
        <Button
          disabled={!name.trim() || !email.trim() || !chosen}
          onClick={() => {
            if (!chosen) return
            setToken(onInvite({ name: name.trim(), email: email.trim() }, chosen))
            setName('')
            setEmail('')
          }}
        >
          Create invite link
        </Button>
      </div>
      {token && <InviteLink token={token} />}
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-subtle">
        <Lock size={12} className="mt-0.5 shrink-0" aria-hidden />
        You can invite people to any role below your own. Invite emails are not sent yet: share the
        link directly.
      </p>
    </div>
  )
}

function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/organizer/join/${token}`
  return (
    <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3">
      <p className="text-[12px] font-medium text-success">Invite link created.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 text-[11px] text-muted">{path}</code>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(`${window.location.origin}${path}`).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <Link to={path} className="text-[12px] font-medium text-accent hover:underline">
          Open
        </Link>
      </div>
    </div>
  )
}

function MemberRow({ member, role, onOpen }: { member: OrgMember; role?: OrgRoleDef; onOpen: () => void }) {
  const invited = member.status === 'invited'
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2"
      >
        <MemberAvatar member={member} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium text-fg">{member.name}</span>
            {member.isYou && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">You</span>
            )}
            {role && <RoleChip role={role} />}
            {invited && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">Invited · pending</span>
            )}
          </span>
          <span className="block truncate text-[12px] text-subtle">{member.title || member.email}</span>
        </span>
        <span className="hidden shrink-0 text-[11px] text-subtle sm:block">
          {invited ? 'Awaiting acceptance' : joinedLabel(member.joinedDaysAgo)}
        </span>
        <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />
      </button>
    </li>
  )
}

interface ActivityRow {
  id: string
  actor_name: string
  actor_user: string | null
  action: string
  detail: string
  created_at: string
}

const ACTIVITY_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** The last few things the team did. The full, filterable log is the
 *  Activity tab; each name here opens that person. */
function ActivityTrail({
  orgId,
  real,
  onActor,
}: {
  orgId: string
  real: boolean
  onActor: (userId: string, name: string) => void
}) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)

  useEffect(() => {
    if (!real) return
    let active = true
    void (async () => {
      const { data } = await supabase
        .from('org_activity')
        .select('id, actor_name, actor_user, action, detail, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (active) setRows((data as ActivityRow[] | null) ?? [])
    })()
    return () => {
      active = false
    }
  }, [orgId, real])

  if (!real || !rows || rows.length === 0) return null

  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        <Activity size={13} className="text-accent" aria-hidden />
        Recent activity
        <Link to="/organizer/activity" className="ml-auto font-medium normal-case tracking-normal text-accent hover:underline">
          Full log
        </Link>
      </h2>
      <ul className="overflow-hidden rounded-xl border border-border">
        {rows.map((r, i) => (
          <li key={r.id} className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3.5 py-2.5', i > 0 && 'border-t border-border/70')}>
            <span className="text-[13px] text-muted">
              {r.actor_user ? (
                <button
                  type="button"
                  onClick={() => onActor(r.actor_user!, r.actor_name)}
                  className="font-medium text-fg hover:underline"
                >
                  {r.actor_name || 'Someone'}
                </button>
              ) : (
                <strong className="font-medium text-fg">{r.actor_name || 'Someone'}</strong>
              )}{' '}
              {r.action}
              {r.detail && <span className="text-subtle"> · {r.detail}</span>}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-subtle">{ACTIVITY_FMT.format(new Date(r.created_at))}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
