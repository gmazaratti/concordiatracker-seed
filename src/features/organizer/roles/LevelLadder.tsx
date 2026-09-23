import { ArrowDown, ArrowUp, Lock } from 'lucide-react'
import type { OrgRoleDef } from '@/lib/org-roles'
import { RoleGlyph } from '../RoleChip'
import { cn } from '@/lib/cn'

/**
 * Where a role sits, shown as the ladder it sits on.
 *
 * A slider asked for a number (1–99) that means nothing on its own: what
 * matters is only which roles this one is above and below. So the ladder
 * shows them, with this role highlighted in place, and Move up / Move down
 * slot it between its neighbours. The number is still what is stored, and
 * still shown small, because it is what the hierarchy compares.
 *
 * It can never climb to your own level or past a role above you: those rows
 * are locked, and the move stops beneath them.
 */
export function LevelLadder({
  others,
  name,
  color,
  icon,
  position,
  mine,
  disabled,
  onChange,
}: {
  /** Every OTHER role in the club. */
  others: OrgRoleDef[]
  name: string
  color: string
  icon: string | null
  position: number
  mine: number
  disabled?: boolean
  onChange: (pos: number) => void
}) {
  const ceiling = Math.min(mine, 100) // strictly below this
  const sorted = [...others].sort((a, b) => b.position - a.position)
  // Ties sort this role ABOVE its equal, which is what "move here" meant.
  const above = sorted.filter((r) => r.position > position)
  const below = sorted.filter((r) => r.position <= position)
  const nextUp = above.at(-1)
  const nextDown = below[0]

  const up = () => {
    if (!nextUp || nextUp.position >= ceiling - 1) return
    const roof = above.at(-2)?.position ?? ceiling
    const mid = Math.floor((nextUp.position + Math.min(roof, ceiling)) / 2)
    onChange(Math.min(ceiling - 1, mid > nextUp.position ? mid : nextUp.position + 1))
  }
  const down = () => {
    if (!nextDown) return
    const floor = below[1]?.position ?? 0
    const mid = Math.ceil((nextDown.position + floor) / 2)
    onChange(Math.max(1, mid < nextDown.position ? mid : nextDown.position - 1))
  }
  const canUp = !disabled && !!nextUp && nextUp.position < ceiling - 1
  const canDown = !disabled && !!nextDown && position > 1

  const row = (r: OrgRoleDef) => {
    const locked = r.isOwner || r.position >= mine
    return (
      <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-muted">
        <RoleGlyph role={r} className="size-6" />
        <span className="min-w-0 flex-1 truncate">{r.name}</span>
        {locked && <Lock size={11} className="text-subtle" aria-label="Above you" />}
        <span className="w-7 text-right text-[11px] text-subtle tabular-nums">{r.position}</span>
      </li>
    )
  }

  return (
    <div>
      <ol className="overflow-hidden rounded-xl border border-border" aria-label="Role ranking, highest first">
        {above.map(row)}
        <li
          className={cn(
            'flex items-center gap-2 border-y border-accent/40 bg-accent-soft/50 px-3 py-2 text-[13px] font-medium text-fg',
            above.length === 0 && 'border-t-0',
          )}
          aria-current="true"
        >
          <RoleGlyph role={{ icon, color }} className="size-6" />
          <span className="min-w-0 flex-1 truncate">{name || 'This role'}</span>
          {!disabled && (
            <span className="flex gap-1">
              <button
                type="button"
                onClick={up}
                disabled={!canUp}
                aria-label="Move up"
                className="grid size-7 place-items-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg disabled:opacity-35"
              >
                <ArrowUp size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={down}
                disabled={!canDown}
                aria-label="Move down"
                className="grid size-7 place-items-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg disabled:opacity-35"
              >
                <ArrowDown size={14} aria-hidden />
              </button>
            </span>
          )}
          <span className="w-7 text-right text-[11px] text-subtle tabular-nums">{position}</span>
        </li>
        {below.map(row)}
      </ol>
    </div>
  )
}
