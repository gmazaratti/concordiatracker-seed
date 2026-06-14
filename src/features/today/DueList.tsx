import { useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { DueRow } from './DueRow'
import type { DueGroups } from './due'

export function DueList({
  groups,
  completed,
  courseById,
  onComplete,
  onUndo,
}: {
  groups: DueGroups
  completed: Assessment[]
  courseById: (id: string) => Course | undefined
  onComplete: (id: string) => void
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
                  done={false}
                  onToggle={() => onComplete(a.id)}
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
                  done={false}
                  onToggle={() => onComplete(a.id)}
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
        <span>
          Completed today · {items.length}
        </span>
        <ChevronDown
          size={15}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="divide-y divide-border/60 pb-1">
          {items.map((a) => (
            <DueRow
              key={a.id}
              assessment={a}
              course={courseById(a.courseId)}
              done
              onToggle={() => onUndo(a.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
