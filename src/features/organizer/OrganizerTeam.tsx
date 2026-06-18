import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Check, Copy, Lock, Trash2, UserPlus } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { OrgMember, OrgRole } from '@/data/teacher'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

const ROLE_LABEL: Record<OrgRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

function joinedLabel(days: number): string {
  if (days <= 0) return 'Joined today'
  if (days === 1) return 'Joined yesterday'
  if (days < 30) return `Joined ${days}d ago`
  if (days < 365) return `Joined ${Math.floor(days / 30)}mo ago`
  return `Joined ${Math.floor(days / 365)}y ago`
}

/** `/organizer/team` — who can manage this org's dashboard. Invite teammates by
 * link (name/email/role) + see everyone with access. Invite delivery is a STUB:
 * the generated link works in-app; in production it'd be emailed. */
export function OrganizerTeam() {
  const { currentOrg, inviteOrgMember, removeOrgMember } = useTeacher()
  if (!currentOrg) return <Navigate to="/organizer" replace />

  return <TeamView members={currentOrg.members} invite={inviteOrgMember} remove={removeOrgMember} />
}

function TeamView({
  members,
  invite,
  remove,
}: {
  members: OrgMember[]
  invite: ReturnType<typeof useTeacher>['inviteOrgMember']
  remove: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('member')
  const [lastToken, setLastToken] = useState<string | null>(null)

  function send() {
    if (!name.trim() || !email.trim()) return
    const m = invite({ name: name.trim(), email: email.trim(), role })
    setLastToken(m.inviteToken ?? null)
    setName('')
    setEmail('')
    setRole('member')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <Link
        to="/organizer"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden />
        Dashboard
      </Link>

      <h1 className="font-display text-[22px] leading-tight font-semibold text-fg">Team</h1>
      <p className="text-[13px] text-subtle">People who can manage this org's events and profile.</p>

      {/* Invite */}
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
          <label className="sm:w-32">
            <span className="mb-1 block text-[12px] font-medium text-muted">Role</span>
            <Select
              ariaLabel="Role"
              value={role}
              onChange={(v) => setRole(v as OrgRole)}
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'member', label: 'Member' },
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
          Invite emails are stubbed in this build — share the generated link directly.
        </p>
      </div>

      {/* Members */}
      <h2 className="mt-6 mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        With access · {members.length}
      </h2>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <MemberRow key={m.id} member={m} onRemove={() => remove(m.id)} />
        ))}
      </ul>
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

function MemberRow({ member, onRemove }: { member: OrgMember; onRemove: () => void }) {
  const invited = member.status === 'invited'
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-fg">{member.name}</span>
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
      {member.role !== 'owner' && (
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
    </li>
  )
}
