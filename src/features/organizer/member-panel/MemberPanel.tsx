import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { SidePanel } from '@/components/SidePanel'
import { roleIdOf } from '@/lib/org-roles'
import { MemberAvatar } from '../MemberAvatar'
import { RoleChip } from '../RoleChip'
import { useOrgRoles } from '../use-org-roles'
import { MemberActions } from './MemberActions'
import { MemberHistory } from './MemberHistory'
import type { MemberRef } from './member-panel'

const DATE = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const DAY = 86_400_000
/** Module level: `react-hooks/purity` bars a clock read in a component body. */
const nowMs = () => Date.now()

/**
 * One teammate, from wherever their name was clicked.
 *
 * WHAT IS HERE IS WHAT A CLUB ACTUALLY NEEDS TO KNOW about somebody on its
 * team: who they are, what they hold, how to reach them, how long they have
 * been around, and what they did lately. The actions are only the ones that
 * would SUCCEED — a button the server is going to refuse is a lie with a
 * spinner on it, so the panel asks the same hierarchy the database does and
 * leaves the rest out.
 */
export function MemberPanel({ target, onClose }: { target: MemberRef; onClose: () => void }) {
  const { currentOrg, orgPerms, refreshOrgs } = useTeacher()
  const orgId = currentOrg?.id ?? ''
  const { roles, mine, refresh } = useOrgRoles(orgId || undefined)

  const member = currentOrg?.members.find(
    (m) => (target.memberId && m.id === target.memberId) || (target.userId && m.userId === target.userId),
  )
  const roleId = member ? roleIdOf(member, orgId, roles) : undefined
  const role = roles?.find((r) => r.id === roleId)

  return (
    <SidePanel label="Team member" title="Team member" onClose={onClose}>
      {(close) =>
        !member ? (
          // Somebody the log still names who is no longer on the team.
          <div className="px-5 py-6">
            <p className="text-[15px] font-semibold text-fg">{target.name ?? 'Former teammate'}</p>
            <p className="mt-1 text-[13px] text-subtle">
              Not on the team any more. Their past actions stay in the activity log.
            </p>
            {target.userId && <MemberHistory orgId={orgId} userId={target.userId} />}
          </div>
        ) : (
          <div className="flex flex-col">
            <section className="flex flex-col items-center px-5 pt-3 pb-5 text-center">
              <MemberAvatar member={member} className="size-20" textClass="text-[24px]" />
              <p className="mt-3 flex items-center gap-2 text-[18px] font-semibold text-fg">
                {member.name}
                {member.isYou && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">
                    You
                  </span>
                )}
              </p>
              {member.title && <p className="text-[13px] text-muted">{member.title}</p>}
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {role && <RoleChip role={role} />}
                {member.status === 'invited' && (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[12px] font-medium text-warning">
                    Invited · hasn't accepted
                  </span>
                )}
              </div>
            </section>

            <dl className="mx-5 divide-y divide-border rounded-xl border border-border">
              <Fact label="User ID" value={member.userId ?? '—'} mono copy={!!member.userId} />
              <Fact label="Email" value={member.email || '—'} copy={!!member.email} />
              <Fact label="On the team" value={tenure(member)} />
            </dl>

            {roles && (
              <MemberActions
                orgId={orgId}
                member={member}
                role={role}
                roles={roles}
                mine={mine}
                perms={orgPerms}
                onChanged={() => {
                  refresh()
                  refreshOrgs()
                }}
                onRemoved={close}
              />
            )}

            <section className="px-5 pt-6 pb-6">
              <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">Recent actions</h3>
              {member.userId ? (
                <MemberHistory orgId={orgId} userId={member.userId} />
              ) : (
                <p className="text-[13px] text-subtle">Nothing yet — they haven't accepted the invite.</p>
              )}
            </section>
          </div>
        )
      }
    </SidePanel>
  )
}

function tenure(m: { status: string; joinedAt?: string; joinedDaysAgo: number }): string {
  if (m.status === 'invited') return 'Invited, not joined yet'
  const since = m.joinedAt ? new Date(m.joinedAt).getTime() : nowMs() - m.joinedDaysAgo * DAY
  const days = Math.max(0, Math.floor((nowMs() - since) / DAY))
  const span =
    days === 0
      ? 'joined today'
      : days < 31
        ? `${days} day${days === 1 ? '' : 's'}`
        : days < 365
          ? `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'}`
          : `${(days / 365).toFixed(1).replace(/\.0$/, '')} years`
  return `Since ${DATE.format(new Date(since))} · ${span}`
}

function Fact({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <dt className="w-24 shrink-0 text-[12px] text-subtle">{label}</dt>
      <dd className={`min-w-0 flex-1 truncate text-[13px] text-fg ${mono ? 'font-mono text-[12px]' : ''}`} title={value}>
        {value}
      </dd>
      {copy && (
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1400)
            })
          }}
          className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {copied ? <Check size={14} className="text-success" aria-hidden /> : <Copy size={14} aria-hidden />}
        </button>
      )}
    </div>
  )
}
