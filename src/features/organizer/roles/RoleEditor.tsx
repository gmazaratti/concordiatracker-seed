import { useState } from 'react'
import { Loader2, Lock, Trash2 } from 'lucide-react'
import { ORG_PERMS, createOrgRole, updateOrgRole, type OrgPerms, type OrgRoleDef, type RoleDraft } from '@/lib/org-roles'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Switch } from '@/features/settings/controls'
import { IconPicker } from './IconPicker'
import { LevelLadder } from './LevelLadder'
import { cn } from '@/lib/cn'

const GROUPS = ['Posts', 'Events', 'The club', 'People'] as const

/**
 * The middle rail: one role, everything it allows.
 *
 * WHAT YOU CANNOT CHANGE IS SHOWN, NOT HIDDEN. A role above you renders in
 * full with the switches off-limits and one line saying why — seeing that the
 * Owner role can do everything is not a leak, and a blank rail would read as
 * a broken page. The server re-checks every save regardless.
 *
 * There is no "delete the club" switch here, and there cannot be: no key in
 * `ORG_PERMS` names it, and the database refuses the delete for anybody but
 * ConcordiaTracker (db/org_delete_lockdown.sql).
 */
export function RoleEditor({
  orgId,
  role,
  seed,
  mine,
  canEdit,
  onSaved,
  onCancelNew,
  onDelete,
  onNameChange,
  others,
}: {
  orgId: string
  /** Null while creating. */
  role: OrgRoleDef | null
  seed: RoleDraft
  mine: number
  /** Holds roles_grant, or owns the club. */
  canEdit: boolean
  onSaved: (saved: OrgRoleDef) => void
  onCancelNew: () => void
  onDelete: () => void
  /** So the left rail can show a role being created under its new name. */
  onNameChange?: (name: string) => void
  /** The club's other roles, for the ladder. */
  others: OrgRoleDef[]
}) {
  const [name, setName] = useState(seed.name)
  const [color, setColor] = useState(seed.color)
  const [icon, setIcon] = useState(seed.icon ?? 'Shield')
  const [position, setPosition] = useState(seed.position)
  const [perms, setPerms] = useState<OrgPerms>(seed.permissions)
  const [seesLog, setSeesLog] = useState(seed.canViewActivity)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const lock: 'fixed' | 'above' | 'no-perm' | null = role?.isOwner
    ? 'fixed'
    : role && role.position >= mine
      ? 'above'
      : !canEdit
        ? 'no-perm'
        : null
  const ro = lock !== null
  const draft: RoleDraft = { name: name.trim(), color, icon, position, permissions: perms, canViewActivity: seesLog }
  const dirty =
    !role ||
    draft.name !== role.name ||
    color !== role.color ||
    icon !== (role.icon ?? 'Shield') ||
    position !== role.position ||
    seesLog !== role.canViewActivity ||
    ORG_PERMS.some((p) => !!perms[p.key] !== !!role.permissions[p.key])
  const ok = draft.name.length > 0 && position < mine && dirty

  function reset() {
    if (!role) return onCancelNew()
    setName(role.name)
    setColor(role.color)
    setIcon(role.icon ?? 'Shield')
    setPosition(role.position)
    setPerms(role.permissions)
    setSeesLog(role.canViewActivity)
    setErr('')
  }

  function save() {
    setBusy(true)
    setErr('')
    void (role ? updateOrgRole(role.id, draft) : createOrgRole(orgId, draft))
      .then(onSaved)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not save.'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex flex-col">
      {lock && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-surface-2/70 px-3 py-2 text-[12.5px] text-subtle">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
          {lock === 'fixed'
            ? 'The Owner role is fixed: an owner can always do everything.'
            : lock === 'above'
              ? 'This role sits at or above yours, so you can see it but not change it.'
              : 'Your role can see roles but not edit them.'}
        </p>
      )}

      <span className="mb-1 block text-[12px] font-medium text-muted">Name</span>
      <div className="flex items-center gap-2">
        <input
          value={name}
          disabled={ro}
          onChange={(e) => {
            setName(e.target.value)
            onNameChange?.(e.target.value)
          }}
          maxLength={30}
          placeholder="Communications"
          aria-label="Role name"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none disabled:opacity-70"
        />
        <IconPicker value={icon} color={color} onChange={setIcon} disabled={ro} />
        {ro ? (
          <span className="size-10 shrink-0 rounded-lg border border-border" style={{ background: color }} aria-label={`Colour ${color}`} />
        ) : (
          <ColorPicker value={color} onChange={setColor} ariaLabel="Role colour" />
        )}
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-[12px] font-medium text-muted">
          Rank <span className="font-normal text-subtle">(higher outranks lower)</span>
        </span>
        <LevelLadder
          others={others}
          name={name}
          color={color}
          icon={icon}
          position={position}
          mine={mine}
          disabled={ro}
          onChange={setPosition}
        />
        <span className="mt-1.5 block text-[11.5px] text-subtle">
          People on this role can hand out roles below it, and nothing above it.
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {GROUPS.map((g) => (
          <div key={g}>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">{g}</p>
            <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {ORG_PERMS.filter((p) => p.group === g).map((p) => (
                <PermRow
                  key={p.key}
                  label={p.label}
                  hint={p.hint}
                  on={role?.isOwner ? true : !!perms[p.key]}
                  disabled={ro}
                  onChange={(v) => setPerms((prev) => ({ ...prev, [p.key]: v }))}
                />
              ))}
            </div>
          </div>
        ))}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">Oversight</p>
          <div className="rounded-xl border border-border">
            <PermRow
              label="See the activity log"
              hint="Every action anybody on the team takes. Owners always see it."
              on={role?.isOwner ? true : seesLog}
              disabled={ro}
              onChange={setSeesLog}
            />
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-[12.5px] text-danger">{err}</p>}

      {!ro && (
        <div className="sticky bottom-0 mt-4 flex items-center gap-2 border-t border-border bg-surface pt-3 pb-1">
          {dirty && (
            <button type="button" onClick={reset} className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtle hover:text-fg">
              {role ? 'Discard changes' : 'Cancel'}
            </button>
          )}
          <Button className="ml-auto" disabled={!ok || busy} onClick={save}>
            {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {role ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      )}

      {role && !ro && role.systemKey === null && (
        <section className="mt-6 rounded-xl border border-danger/40 p-3.5">
          <p className="text-[13px] font-semibold text-danger">Delete this role</p>
          <p className="mt-0.5 text-[12px] text-subtle">
            Anyone holding it moves to Member. You'll be asked to confirm.
          </p>
          <button
            type="button"
            onClick={onDelete}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-danger/60 px-3 py-1.5 text-[12.5px] font-medium text-danger transition-colors hover:bg-danger hover:text-white"
          >
            <Trash2 size={14} aria-hidden />
            Delete role
          </button>
        </section>
      )}
    </div>
  )
}

function PermRow({
  label,
  hint,
  on,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  on: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className={cn('flex items-start gap-3 px-3.5 py-2.5', disabled && 'opacity-75')}>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        <p className="text-[11.5px] leading-snug text-subtle">{hint}</p>
      </div>
      <div className="shrink-0 pt-0.5">
        <Switch checked={on} onChange={onChange} label={label} disabled={disabled} />
      </div>
    </div>
  )
}
