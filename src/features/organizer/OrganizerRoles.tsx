import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import {
  ORG_PERMS,
  createOrgRole,
  deleteOrgRole,
  loadOrgRoles,
  myPosition,
  updateOrgRole,
  type OrgPerms,
  type OrgRoleDef,
  type RoleDraft,
} from '@/lib/org-roles'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Switch } from '@/features/settings/controls'
import { RoleChip, RoleGlyph } from './RoleChip'
import { cn } from '@/lib/cn'

/**
 * `/organizer/roles` — who may do what.
 *
 * THE HIERARCHY IS THE WHOLE INTERFACE. Roles are listed from the top down and
 * a line marks where you sit, because every rule on this screen is the same
 * rule: you may hand out, edit and delete anything BELOW you, and nothing at
 * your own level or above. Roles you cannot touch render in full with a padlock
 * rather than vanishing — a list with gaps in it teaches people the product is
 * broken, and seeing that an Owner role exists is not a leak.
 *
 * NOTHING HERE DECIDES ANYTHING. Every button calls a SECURITY DEFINER verb
 * that re-checks the hierarchy, so the worst a mistake in this file can do is
 * offer an action the server refuses. The `position` guard below is there to
 * make that refusal rare, not to be the defence.
 */
export function OrganizerRoles() {
  const { currentOrg } = useTeacher()
  const orgId = currentOrg?.id ?? ''
  const [roles, setRoles] = useState<OrgRoleDef[] | null>(null)
  const [mine, setMine] = useState(-1)
  const [editing, setEditing] = useState<OrgRoleDef | 'new' | null>(null)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!orgId) return
    let alive = true
    void Promise.all([loadOrgRoles(orgId), myPosition(orgId)])
      .then(([r, p]) => {
        if (!alive) return
        setRoles(r)
        setMine(p)
      })
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : 'Could not load roles.'))
    return () => {
      alive = false
    }
  }, [orgId, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  if (!currentOrg) return null

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-fg">Roles</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            What each person on your team is allowed to do. You can hand out any role below
            your own — never your own, and never one above it.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus size={15} aria-hidden />
          New role
        </Button>
      </header>

      {err && <p className="mt-4 text-[13px] text-danger">{err}</p>}

      {roles === null ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
        </div>
      ) : (
        <ol className="mt-5 flex flex-col">
          {roles.map((r, i) => {
            const managed = r.position < mine && !r.isOwner
            const prev = roles[i - 1]
            // The line that says "everything under here is yours".
            const showYouAre = prev && prev.position >= mine && r.position < mine
            return (
              <li key={r.id}>
                {showYouAre && <YouAreHere />}
                <RoleRow role={r} managed={managed} onEdit={() => setEditing(r)} onChanged={refresh} />
              </li>
            )
          })}
        </ol>
      )}

      {editing && (
        <RoleEditor
          orgId={orgId}
          role={editing === 'new' ? null : editing}
          myPosition={mine}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function YouAreHere() {
  return (
    <div className="my-1 flex items-center gap-2" aria-hidden>
      <span className="h-px flex-1 bg-accent/40" />
      <span className="text-[11px] font-medium tracking-wide text-accent uppercase">
        You rank here
      </span>
      <span className="h-px w-8 bg-accent/40" />
    </div>
  )
}

function RoleRow({
  role,
  managed,
  onEdit,
  onChanged,
}: {
  role: OrgRoleDef
  managed: boolean
  onEdit: () => void
  onChanged: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const granted = ORG_PERMS.filter((p) => role.permissions[p.key]).length

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3',
        !managed && 'opacity-70',
      )}
    >
      <RoleGlyph role={role} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <RoleChip role={role} />
          {role.isOwner && (
            <span className="text-[11px] text-subtle">can do everything, always</span>
          )}
          {role.canViewActivity && !role.isOwner && (
            <span className="text-[11px] text-subtle">sees the activity log</span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-subtle">
          {role.isOwner
            ? 'Every permission'
            : `${granted} of ${ORG_PERMS.length} permissions`}
          {' · '}level {role.position}
        </p>
      </div>

      {managed ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
          {role.systemKey === null &&
            (confirm ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void deleteOrgRole(role.id)
                    .then(onChanged)
                    .finally(() => setBusy(false))
                }}
                className="rounded-lg bg-danger px-2.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Really delete
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Delete ${role.name}`}
                onClick={() => setConfirm(true)}
                className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            ))}
        </div>
      ) : (
        <span
          className="flex shrink-0 items-center gap-1 text-[11.5px] text-subtle"
          title={
            role.isOwner
              ? 'The Owner role is fixed — it is what "owner" means'
              : 'This role is at or above your own'
          }
        >
          <Lock size={12} aria-hidden />
          {/* An owner is not "below" the Owner role; it is simply not editable,
              and saying the wrong reason is worse than saying none. */}
          {role.isOwner ? 'Fixed' : 'Above you'}
        </span>
      )}
    </div>
  )
}

/* ── The editor ────────────────────────────────────────────────────────────── */

const GROUPS = ['Posts', 'Events', 'The club', 'People'] as const

function RoleEditor({
  orgId,
  role,
  myPosition: mine,
  onClose,
  onSaved,
}: {
  orgId: string
  role: OrgRoleDef | null
  myPosition: number
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [color, setColor] = useState(role?.color ?? '#8fb39a')
  const [icon, setIcon] = useState(role?.icon ?? 'Shield')
  // Default just under the caller, which is what somebody making a role
  // almost always means. Capped so it can never land at their own level.
  const [position, setPosition] = useState(
    role?.position ?? Math.max(1, Math.min(mine - 1, 30)),
  )
  const [perms, setPerms] = useState<OrgPerms>(role?.permissions ?? {})
  const [seesLog, setSeesLog] = useState(role?.canViewActivity ?? false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const draft: RoleDraft = {
    name: name.trim(),
    color,
    icon,
    position,
    permissions: perms,
    canViewActivity: seesLog,
  }
  const tooHigh = position >= mine
  const ok = draft.name.length > 0 && !tooHigh

  function save() {
    setBusy(true)
    setErr('')
    const p = role ? updateOrgRole(role.id, draft) : createOrgRole(orgId, draft)
    void p
      .then(onSaved)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not save.'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="mt-5 rounded-2xl border border-accent/40 bg-surface p-4">
      <h2 className="text-[15px] font-semibold text-fg">
        {role ? `Edit ${role.name}` : 'New role'}
      </h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-[12px] font-medium text-muted">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="Communications"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted">Colour</span>
          <ColorPicker value={color} onChange={setColor} ariaLabel="Role colour" />
        </label>
      </div>

      <IconRow value={icon} onChange={setIcon} />

      <label className="mt-3 block">
        <span className="mb-1 block text-[12px] font-medium text-muted">
          Level <span className="text-subtle">— higher outranks lower</span>
        </span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            className="ct-range min-w-0 flex-1"
            min={1}
            max={Math.max(1, mine - 1)}
            value={Math.min(position, Math.max(1, mine - 1))}
            onChange={(e) => setPosition(Number(e.target.value))}
            aria-label="Role level"
          />
          <span className="w-8 text-right text-[12px] text-subtle tabular-nums">{position}</span>
        </div>
        <span className="mt-1 block text-[11.5px] text-subtle">
          {tooHigh
            ? 'A role has to sit below your own.'
            : 'Anyone on this role can only hand out roles below this number.'}
        </span>
      </label>

      <div className="mt-4 flex flex-col gap-3">
        {GROUPS.map((g) => (
          <div key={g}>
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">{g}</p>
            <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {ORG_PERMS.filter((p) => p.group === g).map((p) => (
                <PermRow
                  key={p.key}
                  label={p.label}
                  hint={p.hint}
                  on={!!perms[p.key]}
                  onChange={(v) => setPerms((prev) => ({ ...prev, [p.key]: v }))}
                />
              ))}
            </div>
          </div>
        ))}
        <PermRow
          label="See the activity log"
          hint="Every action anybody on the team takes. Owners always see it."
          on={seesLog}
          onChange={setSeesLog}
          boxed
        />
      </div>

      {err && <p className="mt-3 text-[12.5px] text-danger">{err}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtle transition-colors hover:text-fg"
        >
          Cancel
        </button>
        <Button className="ml-auto" disabled={!ok || busy} onClick={save}>
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          {role ? 'Save changes' : 'Create role'}
        </Button>
      </div>
    </div>
  )
}

function PermRow({
  label,
  hint,
  on,
  onChange,
  boxed,
}: {
  label: string
  hint: string
  on: boolean
  onChange: (v: boolean) => void
  boxed?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3.5 py-2.5',
        boxed && 'rounded-xl border border-border',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        <p className="text-[11.5px] leading-snug text-subtle">{hint}</p>
      </div>
      <div className="shrink-0 pt-0.5">
        <Switch checked={on} onChange={onChange} label={label} />
      </div>
    </div>
  )
}

/** A short, deliberately boring list. A role icon is a marker, not a mood —
 *  and every one here exists in lucide, so a saved name always renders. */
const ICONS = ['Shield', 'Crown', 'User', 'Megaphone', 'CalendarDays', 'Pencil', 'Star', 'Wrench']

function IconRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-3">
      <span className="mb-1 block text-[12px] font-medium text-muted">Icon</span>
      <div className="flex flex-wrap gap-1.5">
        {ICONS.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={n}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={cn(
              'grid size-9 place-items-center rounded-lg border transition-colors duration-150',
              value === n
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <RoleGlyph role={{ icon: n, color: 'currentColor' }} bare />
          </button>
        ))}
      </div>
    </div>
  )
}
