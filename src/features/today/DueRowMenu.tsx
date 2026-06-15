import { ArrowUpRight, Pencil } from 'lucide-react'
import type { AssessmentStatus } from '@/data/types'
import { STATUS_META } from '@/lib/status'
import { cn } from '@/lib/cn'

/** The statuses the row's "…" menu offers, in lifecycle order. The open ones
 * (in-progress, extension) annotate the item in place; the rest resolve it and
 * lift it into "Completed today". */
const MENU_STATUSES: AssessmentStatus[] = [
  'in-progress',
  'extension',
  'done',
  'late',
  'missed',
]

/** The overflow menu that keeps the row surface clean: every secondary action —
 * status changes, the full editor, jumping to the course — lives in here, so the
 * collapsed row only ever shows the check, the title, and the due date. Rendered
 * inline (not an absolute popover) so the list Card's clip never crops it. */
export function DueRowMenu({
  onPick,
  onEdit,
  onOpenCourse,
}: {
  onPick: (status: AssessmentStatus) => void
  onEdit: () => void
  onOpenCourse: () => void
}) {
  return (
    <div className="ct-animate-fade mt-2 ml-8 rounded-lg border border-border bg-surface-2/60 p-2">
      <p className="px-1 pb-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">
        Mark as
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MENU_STATUSES.map((s) => {
          const meta = STATUS_META[s]
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
            >
              <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
              {meta.label}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
        <MenuLink icon={Pencil} label="Edit details" onClick={onEdit} />
        <MenuLink icon={ArrowUpRight} label="Open in course" onClick={onOpenCourse} />
      </div>
    </div>
  )
}

function MenuLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted transition-colors duration-150 hover:bg-surface hover:text-fg"
    >
      <Icon size={13} aria-hidden />
      {label}
    </button>
  )
}
