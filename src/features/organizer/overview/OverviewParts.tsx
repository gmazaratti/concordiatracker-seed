import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Circle, Sparkles, type LucideIcon } from 'lucide-react'
import type { ManagedEvent } from '@/data/teacher'
import { formatDueDateTime } from '@/lib/date'
import { CATEGORY_META } from '@/features/community/category'
import { cn } from '@/lib/cn'

export function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-0.5 text-[12.5px] font-medium text-accent hover:underline"
    >
      {label} <ChevronRight size={14} aria-hidden />
    </Link>
  )
}

export function ActionCard({
  icon: Icon,
  label,
  sub,
  to,
  onClick,
  accent,
  disabled,
}: {
  icon: LucideIcon
  label: string
  sub: string
  to?: string
  onClick?: () => void
  accent?: boolean
  disabled?: boolean
}) {
  const inner = (
    <>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          accent ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted',
        )}
      >
        <Icon size={17} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-fg">{label}</span>
        <span className="block truncate text-[11.5px] text-subtle">{sub}</span>
      </span>
    </>
  )
  const cls = cn(
    'flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition-colors duration-150',
    disabled ? 'opacity-50' : 'hover:border-border-strong hover:bg-surface-2',
  )
  if (disabled) return <div className={cls}>{inner}</div>
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

export interface SetupStep {
  done: boolean
  label: string
  hint: string
  to?: string
  onClick?: () => void
}

export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length
  const cls =
    'flex items-center gap-2.5 border-t border-border px-4 py-2.5 transition-colors duration-150'
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Sparkles size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg">Get set up</p>
          <p className="text-[12px] text-subtle">
            {doneCount} of {steps.length} done
          </p>
        </div>
      </div>
      <ul>
        {steps.map((s) => {
          const inner = (
            <>
              {s.done ? (
                <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden />
              ) : (
                <Circle size={18} className="shrink-0 text-border-strong" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[13px] font-medium',
                    s.done ? 'text-subtle line-through' : 'text-fg',
                  )}
                >
                  {s.label}
                </span>
                {!s.done && <span className="block truncate text-[11px] text-subtle">{s.hint}</span>}
              </span>
              {!s.done && <ChevronRight size={15} className="shrink-0 text-subtle" aria-hidden />}
            </>
          )
          return (
            <li key={s.label}>
              {s.done ? (
                <div className={cls}>{inner}</div>
              ) : s.to ? (
                <Link to={s.to} className={cn(cls, 'hover:bg-surface-2/50')}>
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={s.onClick}
                  className={cn(cls, 'w-full text-left hover:bg-surface-2/50')}
                >
                  {inner}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function UpcomingRow({ event }: { event: ManagedEvent }) {
  const cat = CATEGORY_META[event.category]
  const Icon = cat.icon
  const title = event.title.trim() || 'Untitled event'
  return (
    <li>
      <Link
        to={`/organizer/event/${event.id}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `${cat.hex}1f`, color: cat.hex }}
          aria-hidden
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-fg">{title}</span>
          <p className="truncate text-[12px] text-subtle">{formatDueDateTime(event.start)}</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />
      </Link>
    </li>
  )
}
