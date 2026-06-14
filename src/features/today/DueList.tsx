import { useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import type { Assessment, AssessmentStatus, Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/cn'
import { DueRow } from './DueRow'
import type { DueGroups } from './due'

export function DueList({
  groups,
  completed,
  courseById,
  onResolve,
  onUndo,
}: {
  groups: DueGroups
  completed: Assessment[]
  courseById: (id: string) => Course | undefined
  onResolve: (id: string, status: AssessmentStatus) => void
  onUndo: (id: string) => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-wide text-fg uppercase">
          Due
        </h2>
        {groups.count > 0 && (
          <span className="text-[12px] text-subtle">
            {groups.count} {groups.count === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {groups.count === 0 ? (
        <EmptyState />
      ) : (
        <>
          {groups.overdue.length > 0 && (
            <Section label="Overdue" tone="danger">
              {groups.overdue.map((a) => (
                <DueRow
                  key={a.id}
                  assessment={a}
                  course={courseById(a.courseId)}
                  onResolve={(status) => onResolve(a.id, status)}
                />
              ))}
            </Section>
          )}
          {groups.thisWeek.length > 0 && (
            <Section label="This week" tone="muted">
              {groups.thisWeek.map((a) => (
                <DueRow
                  key={a.id}
                  assessment={a}
                  course={courseById(a.courseId)}
                  onResolve={(status) => onResolve(a.id, status)}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {completed.length > 0 && (
        <CompletedToday
          items={completed}
          courseById={courseById}
          onUndo={onUndo}
        />
      )}
    </Card>
  )
}

function Section({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'danger' | 'muted'
  children: React.ReactNode
}) {
  return (
    <section>
      <p
        className={cn(
          'px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide uppercase',
          tone === 'danger' ? 'text-danger' : 'text-subtle',
        )}
      >
        {label}
      </p>
      <ul className="divide-y divide-border/60">{children}</ul>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <CheckCircle2 size={26} aria-hidden />
      </span>
      <h3 className="font-display text-xl font-medium text-fg">
        All caught up
      </h3>
      <p className="max-w-xs text-sm text-muted">
        Nothing due in the next week. Enjoy the breathing room — new deadlines
        show up here the moment they land.
      </p>
    </div>
  )
}

function CompletedToday({
  items,
  courseById,
  onUndo,
}: {
  items: Assessment[]
  courseById: (id: string) => Course | undefined
  onUndo: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12px] text-subtle transition-colors duration-150 hover:text-muted"
      >
        <span>Completed today · {items.length}</span>
        <ChevronDown
          size={15}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="divide-y divide-border/60 pb-1">
          {items.map((a) => (
            <CompletedRow
              key={a.id}
              assessment={a}
              course={courseById(a.courseId)}
              onUndo={() => onUndo(a.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function CompletedRow({
  assessment,
  course,
  onUndo,
}: {
  assessment: Assessment
  course: Course | undefined
  onUndo: () => void
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge status={assessment.status} />
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
            {course?.code ?? '—'}
          </span>
          <span
            className={cn(
              'truncate text-[13px] text-subtle',
              assessment.status === 'done' && 'line-through',
            )}
          >
            {assessment.title}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 rounded-md px-2 py-1 text-[12px] text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        Undo
      </button>
    </li>
  )
}
