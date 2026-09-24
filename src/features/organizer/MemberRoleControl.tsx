import { useState } from 'react'
import { Crown, Loader2 } from 'lucide-react'
import type { OrgMember } from '@/data/teacher'
import { setMemberRole, transferOwnership, type OrgRoleDef } from '@/lib/org-roles'
import { Select } from '@/components/ui/Select'
import { RoleChip } from './RoleChip'

/**
 * One member's role, and the one irreversible thing next to it.
 *
 * THE LIST ONLY CONTAINS ROLES YOU MAY ACTUALLY GRANT — strictly below your
 * own — so the hierarchy is a shorter dropdown rather than an error message
 * after the fact. Their CURRENT role is added even when it is above you, or
 * the control would silently misrepresent what they hold; it is just not
 * selectable, and the chip beside it is what they are.
 *
 * Every pick calls `set_org_member_role`, which re-checks both ends: the role
 * being given AND the role being taken away, so somebody junior cannot demote
 * a senior by handing them something harmless.
 */
export function MemberRoleControl({
  member,
  roles,
  myPosition,
  orgId,
  onChanged,
}: {
  member: OrgMember
  roles: OrgRoleDef[]
  myPosition: number
  orgId: string
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmOwner, setConfirmOwner] = useState(false)

  const current = roles.find((r) => r.id === member.roleId)
  const theirPosition = current?.position ?? -1
  // You cannot touch somebody at or above your own level, and you cannot
  // change your own role — the same rule the database enforces.
  const mayManage = theirPosition < myPosition && !member.isYou
  const grantable = roles.filter((r) => r.position < myPosition && !r.isOwner)
  const amOwner = myPosition > 1_000_000

  if (!current && roles.length === 0) return null

  if (!mayManage) {
    return current ? <RoleChip role={current} /> : null
  }

  const options = [
    ...(current && !grantable.some((r) => r.id === current.id)
      ? [{ value: current.id, label: `${current.name} (current)` }]
      : []),
    ...grantable.map((r) => ({ value: r.id, label: r.name })),
  ]

  function pick(next: string) {
    if (next === member.roleId) return
    setBusy(true)
    setErr('')
    void setMemberRole(member.id, next)
      .then(onChanged)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not change that.'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {busy && <Loader2 size={13} className="animate-spin text-subtle" aria-hidden />}
        <Select
          value={member.roleId ?? ''}
          onChange={pick}
          options={options}
          size="sm"
          ariaLabel={`Role for ${member.name}`}
          placeholder="No role"
        />
        {/* OWNERSHIP IS NOT IN THE DROPDOWN. It is not one more option on a
            list — it hands somebody the handle, the team and this button, so
            it asks twice and says what it does. */}
        {amOwner && member.status === 'active' && (
          <button
            type="button"
            title="Make this person an owner"
            onClick={() => {
              if (!confirmOwner) {
                setConfirmOwner(true)
                return
              }
              setBusy(true)
              void transferOwnership(orgId, member.id, false)
                .then(onChanged)
                .catch((e: unknown) =>
                  setErr(e instanceof Error ? e.message : 'Could not transfer ownership.'),
                )
                .finally(() => {
                  setBusy(false)
                  setConfirmOwner(false)
                })
            }}
            className={
              confirmOwner
                ? 'rounded-lg bg-danger px-2.5 py-1.5 text-[11.5px] font-medium text-white'
                : 'grid size-8 place-items-center rounded-lg border border-border text-subtle transition-colors hover:bg-surface-2 hover:text-fg'
            }
          >
            {confirmOwner ? 'Yes, make them an owner' : <Crown size={14} aria-hidden />}
          </button>
        )}
      </div>
      {confirmOwner && (
        <p className="max-w-[16rem] text-right text-[11px] leading-snug text-subtle">
          They get everything, including the handle. You stay an owner too.
        </p>
      )}
      {err && <p className="max-w-[16rem] text-right text-[11px] text-danger">{err}</p>}
    </div>
  )
}
