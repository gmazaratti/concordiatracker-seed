import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Activity, ChevronRight } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { supabase } from '@/lib/supabase'
import type { OrgMember, OrgRole } from '@/data/teacher'
import { roleIdOf, setMemberRole, type OrgRoleDef } from '@/lib/org-roles'
import { isDemoOrgId } from '@/lib/demo-org'
import { cn } from '@/lib/cn'
import { MemberAvatar } from './MemberAvatar'
import { RoleChip } from './RoleChip'
import { useOrgRoles } from './use-org-roles'
import { useMemberPanel } from './member-panel/member-panel'
import { InviteForm } from './team/InviteForm'

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
          orgId={orgId}
          roles={roles}
          mine={mine}
          demo={isDemoOrgId(orgId)}
          onDemoInvite={(input, role) => {
            const m = inviteOrgMember({ ...input, role: legacyFor(role) })
            void setMemberRole(m.id, role.id).then(refreshOrgs)
            return m.inviteToken ?? null
          }}
          onInvited={refreshOrgs}
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
