import { Lock } from 'lucide-react'
import type { OrgMember } from '@/data/teacher'
import type { OrgRoleDef } from '@/lib/org-roles'
import { MemberAvatar } from '../MemberAvatar'
import { RoleGlyph } from '../RoleChip'
import { cn } from '@/lib/cn'

/**
 * The left rail: every role, top of the hierarchy first, with a line where
 * you sit. Every rule on this page is the same rule — you may change anything
 * BELOW that line — so the line is the most useful thing on it.
 */
export function RoleList({
  roles,
  mine,
  selected,
  holders,
  onSelect,
  draftName,
}: {
  roles: OrgRoleDef[]
  mine: number
  selected: string | null
  holders: (roleId: string) => OrgMember[]
  onSelect: (id: string) => void
  /** A role being created, shown as a card so the list says where it is going. */
  draftName?: string | null
}) {
  return (
    <ol className="flex flex-col gap-1.5">
      {draftName != null && (
        <li>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-accent/60 bg-accent-soft/40 px-3 py-2.5 ring-2 ring-accent">
            <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-[11px] text-subtle">new</span>
            <span className="truncate text-[13.5px] font-medium text-fg">{draftName.trim() || 'New role'}</span>
          </div>
        </li>
      )}
      {roles.map((r, i) => {
        const prev = roles[i - 1]
        const youHere = prev && prev.position >= mine && r.position < mine
        const people = holders(r.id)
        const locked = r.isOwner || r.position >= mine
        return (
          <li key={r.id}>
            {youHere && (
              <div className="my-1.5 flex items-center gap-2" aria-hidden>
                <span className="h-px flex-1 bg-accent/40" />
                <span className="text-[10.5px] font-semibold tracking-wide text-accent uppercase">You rank here</span>
                <span className="h-px w-6 bg-accent/40" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              aria-current={selected === r.id ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150',
                selected === r.id
                  ? 'border-accent/50 bg-accent-soft/40'
                  : 'border-border bg-surface hover:bg-surface-2',
              )}
            >
              <RoleGlyph role={r} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-fg">
                  <span className="truncate" style={{ color: r.color }}>
                    {r.name}
                  </span>
                  {locked && <Lock size={11} className="shrink-0 text-subtle" aria-label="Above you" />}
                </p>
                <p className="text-[11.5px] text-subtle">
                  {people.length === 0 ? 'Nobody yet' : `${people.length} ${people.length === 1 ? 'person' : 'people'}`}
                  {' · '}level {r.position}
                </p>
              </div>
              {people.length > 0 && (
                <span className="flex shrink-0 -space-x-2">
                  {people.slice(0, 3).map((m) => (
                    <MemberAvatar key={m.id} member={m} className="size-6 ring-2 ring-surface" textClass="text-[9px]" />
                  ))}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
