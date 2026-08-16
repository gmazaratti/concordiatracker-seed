import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Activity, Check, ChevronDown, Copy, Lock, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAppData } from '@/app/providers/app-data'
import { supabase } from '@/lib/supabase'
import { ORG_PERMS, memberPerms, type OrgMember, type OrgRole } from '@/data/teacher'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/features/settings/controls'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

const ROLE_LABEL: Record<OrgRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

// Deterministic avatar tints (keyed off the name) so the team reads colorfully
// without uploaded photos. Fixed hexes — same across themes, like course colors.
const AVATAR_HUES = ['#5b9cf6', '#a78bfa', '#22b8a6', '#e0853c', '#ec4899', '#4fb89a']

function joinedLabel(days: number): string {
  if (days <= 0) return 'Joined today'
  if (days === 1) return 'Joined yesterday'
  if (days < 30) return `Joined ${days}d ago`
  if (days < 365) return `Joined ${Math.floor(days / 30)}mo ago`
  return `Joined ${Math.floor(days / 365)}y ago`
}

/** `/organizer/team` — who can manage this org's dashboard: invite by link,
 * promote/demote (admin ↔ member), remove, and a "recent activity" trail showing
 * who did what. Invite delivery is a stub — share the generated link. */
export function OrganizerTeam() {
  const { currentOrg, isDemoSession, orgViewerPerms, inviteOrgMember, removeOrgMember, setOrgMemberRole, setOrgMemberPerms } = useTeacher()
  if (!currentOrg) return <Navigate to="/organizer" replace />

  return (
    <TeamView
      orgId={currentOrg.id}
      real={!isDemoSession}
      canManage={orgViewerPerms.manage_team}
      members={currentOrg.members}
      invite={inviteOrgMember}
      remove={removeOrgMember}
      setRole={setOrgMemberRole}
      setPerms={setOrgMemberPerms}
    />
  )
}

function TeamView({
  orgId,
  real,
  canManage,
  members,
  invite,
  remove,
  setRole,
  setPerms,
}: {
  orgId: string
  real: boolean
  canManage: boolean
  members: OrgMember[]
  invite: ReturnType<typeof useTeacher>['inviteOrgMember']
  remove: (id: string) => void
  setRole: (id: string, role: OrgRole) => void
  setPerms: ReturnType<typeof useTeacher>['setOrgMemberPerms']
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRoleState] = useState<OrgRole>('member')
  const [lastToken, setLastToken] = useState<string | null>(null)

  function send() {
    if (!name.trim() || !email.trim()) return
    const m = invite({ name: name.trim(), email: email.trim(), role })
    setLastToken(m.inviteToken ?? null)
    setName('')
    setEmail('')
    setRoleState('member')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">Team</h1>
      <p className="text-[13px] text-subtle">People who can manage this org's events and profile.</p>

      {/* Invite: only for those allowed to manage the team */}
      {canManage && (
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
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="them@org.ca" className={field} />
          </label>
          <label className="sm:w-40">
            <span className="mb-1 block text-[12px] font-medium text-muted">Role</span>
            <Select
              ariaLabel="Role"
              value={role}
              onChange={(v) => setRoleState(v as OrgRole)}
              options={[
                { value: 'admin', label: 'Admin: can edit' },
                { value: 'member', label: 'Member: listed' },
              ]}
            />
          </label>
          <Button disabled={!name.trim() || !email.trim()} onClick={send}>
            Create invite link
          </Button>
        </div>
        {lastToken && <InviteLink token={lastToken} />}
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-subtle">
          <Lock size={12} className="mt-0.5 shrink-0" aria-hidden />
          Admins get the full dashboard; members can view. Fine-tune anyone's permissions below.
          Invite emails are stubbed: share the generated link directly.
        </p>
      </div>
      )}

      {/* Members */}
      <h2 className="mt-6 mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        With access · {members.length}
      </h2>
      <ul className="flex flex-col gap-2">
        {members.map((m, i) => (
          <MemberRow
            key={m.id}
            member={m}
            hue={AVATAR_HUES[i % AVATAR_HUES.length]}
            canManage={canManage}
            onRemove={() => remove(m.id)}
            onRole={(r) => setRole(m.id, r)}
            onPerm={(key, val) => setPerms(m.id, { [key]: val })}
          />
        ))}
      </ul>

      <ActivityTrail orgId={orgId} real={real} />
    </div>
  )
}

function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/organizer/join/${token}`

  function copy() {
    const url = `${window.location.origin}${path}`
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3">
      <p className="text-[12px] font-medium text-success">Invite link created (email stubbed).</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 text-[11px] text-muted">{path}</code>
        <button
          type="button"
          onClick={copy}
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

const ROLE_STYLE: Record<OrgRole, string> = {
  owner: 'bg-accent-soft text-accent',
  admin: 'bg-info/15 text-info',
  member: 'bg-surface-2 text-muted',
}

function Avatar({ member, hue }: { member: OrgMember; hue: string }) {
  const { user } = useAppData()
  const initials =
    member.name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  // Their snapshot photo, your live Google photo for "You", else tinted initials.
  const photo = member.avatarUrl || (member.isYou ? user.avatarUrl : undefined)
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        referrerPolicy="no-referrer"
        className="size-9 shrink-0 rounded-full bg-surface-2 object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white"
      style={{ backgroundColor: hue }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

function MemberRow({
  member,
  hue,
  canManage,
  onRemove,
  onRole,
  onPerm,
}: {
  member: OrgMember
  hue: string
  canManage: boolean
  onRemove: () => void
  onRole: (role: OrgRole) => void
  onPerm: (key: (typeof ORG_PERMS)[number]['key'], value: boolean) => void
}) {
  const invited = member.status === 'invited'
  const locked = member.role === 'owner'
  const [permsOpen, setPermsOpen] = useState(false)
  const effective = memberPerms(member)
  const grantedCount = ORG_PERMS.filter((p) => effective[p.key]).length

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5">
        <Avatar member={member} hue={hue} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-fg">{member.name}</span>
            {member.isYou && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">
                You
              </span>
            )}
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ROLE_STYLE[member.role])}>
              {ROLE_LABEL[member.role]}
            </span>
            {invited && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                Invited · pending
              </span>
            )}
          </div>
          <p className="truncate text-[12px] text-subtle">{member.email}</p>
        </div>
        <span className="shrink-0 text-[11px] text-subtle">
          {invited ? 'Awaiting acceptance' : joinedLabel(member.joinedDaysAgo)}
        </span>
        {/* Permissions (Discord-style): owners hold everything, immutably */}
        {canManage && !locked && (
          <button
            type="button"
            onClick={() => setPermsOpen((o) => !o)}
            aria-expanded={permsOpen}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
              permsOpen
                ? 'border-accent/50 bg-accent-soft/40 text-fg'
                : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <ShieldCheck size={13} aria-hidden />
            {grantedCount}/{ORG_PERMS.length}
            <ChevronDown size={13} className={cn('transition-transform duration-150', permsOpen && 'rotate-180')} aria-hidden />
          </button>
        )}
        {canManage && !locked && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={invited ? 'Revoke invite' : 'Remove member'}
            title={invited ? 'Revoke invite' : 'Remove member'}
            className="inline-grid size-7 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors duration-150 hover:border-danger hover:text-danger"
          >
            <Trash2 size={14} aria-hidden />
          </button>
        )}
      </div>

      {/* Per-member permission toggles + role preset */}
      {canManage && !locked && permsOpen && (
        <div className="border-t border-border bg-surface-2/30 px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[12px] font-medium text-muted">Role preset</p>
            <div className="w-[150px]">
              <Select
                ariaLabel={`Role for ${member.name}`}
                size="sm"
                value={member.role}
                onChange={(v) => onRole(v as OrgRole)}
                options={[
                  { value: 'admin', label: ROLE_LABEL.admin },
                  { value: 'member', label: ROLE_LABEL.member },
                ]}
              />
            </div>
          </div>
          <ul className="flex flex-col gap-2.5">
            {ORG_PERMS.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-fg">{p.label}</p>
                  <p className="text-[11.5px] text-subtle">{p.hint}</p>
                </div>
                <Switch
                  checked={effective[p.key]}
                  onChange={(next) => onPerm(p.key, next)}
                  label={`${p.label} for ${member.name}`}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] text-subtle">
            Changing the role preset resets these to the role's defaults.
          </p>
        </div>
      )}
    </li>
  )
}

interface ActivityRow {
  id: string
  actor_name: string
  action: string
  detail: string
  created_at: string
}

const ACTIVITY_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** The org's audit trail — who did what (events, profile, team), newest first.
 * Real orgs only; the demo world logs nothing. */
function ActivityTrail({ orgId, real }: { orgId: string; real: boolean }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)

  useEffect(() => {
    if (!real) return
    let active = true
    void (async () => {
      const { data } = await supabase
        .from('org_activity')
        .select('id, actor_name, action, detail, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(25)
      if (active) setRows((data as ActivityRow[] | null) ?? [])
    })()
    return () => {
      active = false
    }
  }, [orgId, real])

  if (!real) return null

  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        <Activity size={13} className="text-accent" aria-hidden />
        Recent activity
      </h2>
      {rows === null ? (
        <p className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4 text-center text-[12px] text-subtle">
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-surface/40 px-4 py-5 text-center text-[12.5px] text-subtle">
          Nothing yet: actions your team takes (posting events, editing the profile, team changes)
          show up here.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className={cn(
                'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3.5 py-2.5',
                i > 0 && 'border-t border-border/70',
              )}
            >
              <span className="text-[13px] text-muted">
                <strong className="font-medium text-fg">{r.actor_name || 'Someone'}</strong>{' '}
                {r.action}
                {r.detail && <span className="text-subtle"> · {r.detail}</span>}
              </span>
              <span className="ml-auto shrink-0 text-[11px] text-subtle">
                {ACTIVITY_FMT.format(new Date(r.created_at))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
