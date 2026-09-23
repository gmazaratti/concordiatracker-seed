import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { OrgMember } from '@/data/teacher'
import type { OrgRoleDef } from '@/lib/org-roles'
import { ModalShell } from '@/command/ModalShell'
import { MemberAvatar } from '../MemberAvatar'
import { RoleChip } from '../RoleChip'

/**
 * Deleting a role, with the consequences named before the button.
 *
 * TYPE THE NAME TO CONFIRM. A role is a bundle of permissions several people
 * hold; deleting one quietly takes access away from each of them, and there
 * is no undo. A second click is a reflex — typing a word is a decision.
 */
export function DeleteRoleDialog({
  role,
  holders,
  onCancel,
  onConfirm,
}: {
  role: OrgRoleDef
  holders: OrgMember[]
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const match = typed.trim().toLowerCase() === role.name.trim().toLowerCase()

  return (
    <ModalShell label={`Delete the ${role.name} role`} onClose={onCancel}>
      <div className="px-5 pt-5 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
            <AlertTriangle size={20} aria-hidden />
          </span>
          <h2 className="text-[17px] font-semibold text-fg">Delete this role?</h2>
        </div>
        <div className="mt-3">
          <RoleChip role={role} />
        </div>

        <ul className="mt-3 flex flex-col gap-1.5 text-[13px] leading-snug text-muted">
          <li>
            {holders.length === 0
              ? 'Nobody holds it right now.'
              : `${holders.length} ${holders.length === 1 ? 'person holds' : 'people hold'} it. They move to Member and lose everything this role let them do.`}
          </li>
          <li className="font-medium text-danger">This can't be undone.</li>
        </ul>

        {holders.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {holders.slice(0, 8).map((m) => (
              <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pr-2.5 pl-1 text-[12px] text-fg">
                <MemberAvatar member={m} className="size-5" textClass="text-[9px]" />
                {m.name}
              </span>
            ))}
            {holders.length > 8 && <span className="text-[12px] text-subtle">+{holders.length - 8} more</span>}
          </div>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-[12px] text-muted">
            Type <strong className="font-semibold text-fg">{role.name}</strong> to confirm
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13.5px] text-fg focus:border-danger focus:outline-none"
          />
        </label>
        {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!match || busy}
            onClick={() => {
              setBusy(true)
              setErr('')
              void onConfirm()
                .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not delete it.'))
                .finally(() => setBusy(false))
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Delete role
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
