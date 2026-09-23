import { useState } from 'react'
import { Crown, Loader2, UserMinus } from 'lucide-react'
import type { OrgMember } from '@/data/teacher'
import { useTeacher } from '@/app/providers/teacher'
import { setMemberRole, transferOwnership, type MyOrgPerms, type OrgRoleDef } from '@/lib/org-roles'
import { Select } from '@/components/ui/Select'
import { isOwnerRank } from '../use-org-roles'

/**
 * Only what you could actually do to THIS person.
 *
 * The same three questions the database asks, asked first: do you hold the
 * permission, do you outrank them, and is the role you would give them below
 * you. Anything that fails one of those is left out rather than disabled —
 * and when nothing is left, the panel says why instead of showing an empty
 * box. Every button still calls a verb that re-checks, so a mistake here can
 * only ever offer something the server then refuses.
 */
export function MemberActions({
  orgId,
  member,
  role,
  roles,
  mine,
  perms,
  onChanged,
  onRemoved,
}: {
  orgId: string
  member: OrgMember
  role: OrgRoleDef | undefined
  roles: OrgRoleDef[]
  mine: number
  perms: MyOrgPerms | null
  onChanged: () => void
  onRemoved: () => void
}) {
  const { removeOrgMember } = useTeacher()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState<'owner' | 'remove' | null>(null)

  const amOwner = isOwnerRank(mine)
  const theirs = role?.position ?? -1
  const outrank = amOwner || theirs < mine
  const grantable = roles.filter((r) => r.position < mine && !r.isOwner)

  const canRole = !member.isYou && outrank && !role?.isOwner && (amOwner || !!perms?.roles_grant) && grantable.length > 0
  const canOwner = amOwner && !member.isYou && member.status === 'active' && !role?.isOwner
  const canRemove = !member.isYou && (amOwner || (!!perms?.manage_team && theirs < mine && !role?.isOwner))

  function run(p: Promise<unknown>, after?: () => void) {
    setBusy(true)
    setErr('')
    void p
      .then(() => {
        onChanged()
        after?.()
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => {
        setBusy(false)
        setConfirm(null)
      })
  }

  if (!canRole && !canOwner && !canRemove) {
    return (
      <p className="mx-5 mt-4 rounded-xl bg-surface-2/60 px-3.5 py-3 text-[12.5px] leading-snug text-subtle">
        {member.isYou
          ? 'This is you. Your own role can only be changed by somebody above you.'
          : 'Nothing here you can change — they rank at or above you, or your role does not manage the team.'}
      </p>
    )
  }

  return (
    <section className="px-5 pt-6">
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Manage
        {busy && <Loader2 size={12} className="animate-spin" aria-hidden />}
      </h3>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {canRole && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-fg">Role</p>
              <p className="text-[11.5px] text-subtle">Any role below your own.</p>
            </div>
            <div className="w-[11rem] shrink-0">
              <Select
                size="sm"
                ariaLabel={`Role for ${member.name}`}
                value={role?.id ?? ''}
                placeholder="No role"
                onChange={(id) => id !== role?.id && run(setMemberRole(member.id, id))}
                options={grantable.map((r) => ({ value: r.id, label: r.name }))}
              />
            </div>
          </div>
        )}

        {canOwner && (
          <ConfirmRow
            icon={<Crown size={15} aria-hidden />}
            label="Make them an owner"
            hint="They get everything, including the handle. You stay an owner too."
            armed={confirm === 'owner'}
            confirmLabel="Yes, make them an owner"
            onArm={() => setConfirm('owner')}
            onCancel={() => setConfirm(null)}
            onConfirm={() => run(transferOwnership(orgId, member.id, false))}
          />
        )}

        {canRemove && (
          <ConfirmRow
            danger
            icon={<UserMinus size={15} aria-hidden />}
            label={member.status === 'invited' ? 'Revoke the invite' : 'Remove from the team'}
            hint={
              member.status === 'invited'
                ? 'Their link stops working.'
                : 'They lose access to this portal straight away. Their past actions stay in the log.'
            }
            armed={confirm === 'remove'}
            confirmLabel={member.status === 'invited' ? 'Revoke it' : `Remove ${member.name.split(' ')[0] || 'them'}`}
            onArm={() => setConfirm('remove')}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              removeOrgMember(member.id)
              onRemoved()
            }}
          />
        )}
      </div>
      {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}
    </section>
  )
}

function ConfirmRow({
  icon,
  label,
  hint,
  armed,
  confirmLabel,
  danger,
  onArm,
  onCancel,
  onConfirm,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  armed: boolean
  confirmLabel: string
  danger?: boolean
  onArm: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="px-3.5 py-2.5">
      <button
        type="button"
        onClick={armed ? undefined : onArm}
        className={`flex w-full items-center gap-2.5 text-left text-[13px] font-medium ${danger ? 'text-danger' : 'text-fg'}`}
      >
        {icon}
        {label}
      </button>
      <p className="mt-0.5 pl-[25px] text-[11.5px] text-subtle">{hint}</p>
      {armed && (
        <div className="mt-2 flex gap-2 pl-[25px]">
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white ${danger ? 'bg-danger' : 'bg-accent text-accent-contrast'}`}
          >
            {confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-[12px] text-muted hover:text-fg">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
