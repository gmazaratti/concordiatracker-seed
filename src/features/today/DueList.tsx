import { useState } from 'react'
import { CheckCircle2, ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { Assessment, AssessmentStatus, Course } from '@/data/types'
import type { TodayPrefs } from '@/app/providers/app-data'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'
import { DueRow } from './DueRow'
import { CustomizeToday } from './CustomizeToday'
import type { DueGroups } from './due'

const byDue = (a: Assessment, b: Assessment) =>
  new Date(a.due).getTime() - new Date(b.due).getTime()

interface RowSection {
  key: string
  label: React.ReactNode
  tone: 'danger' | 'muted'
  items: Assessment[]
}

/** Sections for the active list, per the "Group by" preference: time buckets
 * (overdue / this week) or one section per course (soonest-due course first). */
function buildSections(
  groups: DueGroups,
  groupBy: TodayPrefs['groupBy'],
  courseById: (id: string) => Course | undefined,
): RowSection[] {
  if (groupBy === 'course') {
    const map = new Map<string, Assessment[]>()
    for (const a of [...groups.active, ...groups.later].sort(byDue)) {
      const arr = map.get(a.courseId) ?? []
      arr.push(a)
      map.set(a.courseId, arr)
    }
    return [...map.entries()]
      .sort((x, y) => byDue(x[1][0], y[1][0]))
      .map(([courseId, items]) => {
        const course = courseById(courseId)
        const hex = course ? courseColor(course.color).hex : undefined
        return {
          key: courseId,
          tone: 'muted' as const,
          items,
          label: (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
              {course?.code ?? 'Course'}
            </span>
          ),
        }
      })
  }

  const out: RowSection[] = []
  if (groups.overdue.length)
    out.push({ key: 'overdue', label: 'Overdue', tone: 'danger', items: groups.overdue })
  if (groups.thisWeek.length)
    out.push({ key: 'thisweek', label: 'This week', tone: 'muted', items: groups.thisWeek })
  if (groups.later.length)
    out.push({ key: 'later', label: 'Coming up', tone: 'muted', items: groups.later })
  return out
}

export function DueList({
  groups,
  completed,
  prefs,
  courseById,
  onResolve,
  onDelete,
  onUndo,
  onPrefsChange,
}: {
  groups: DueGroups
  completed: Assessment[]
  prefs: TodayPrefs
  courseById: (id: string) => Course | undefined
  onResolve: (id: string, status: AssessmentStatus) => void
  onDelete: (id: string) => void
  onUndo: (id: string) => void
  onPrefsChange: (patch: Partial<TodayPrefs>) => void
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const sections = buildSections(groups, prefs.groupBy, courseById)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-wide text-fg uppercase">Due</h2>
        <div className="flex items-center gap-1.5">
          {groups.total > 0 && (
            <span className="text-[12px] text-subtle">
              {groups.total} {groups.total === 1 ? 'item' : 'items'}
            </span>
          )}
          <button
            type="button"
            data-tour="customize"
            onClick={() => setCustomizeOpen((o) => !o)}
            aria-expanded={customizeOpen}
            aria-label="Customize Today"
            title="Customize Today"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
              customizeOpen && 'bg-surface-2 text-fg',
            )}
          >
            <SlidersHorizontal size={14} aria-hidden />
            <span className="hidden sm:inline">Customize</span>
          </button>
        </div>
      </div>

      {customizeOpen && <CustomizeToday prefs={prefs} onChange={onPrefsChange} />}

      {sections.length === 0 ? (
        <EmptyState />
      ) : (
        sections.map((section, i) => (
          <Section key={section.key} label={section.label} tone={section.tone} divider={i > 0}>
            {section.items.map((a) => (
              <DueRow
                key={a.id}
                assessment={a}
                course={courseById(a.courseId)}
                prefs={prefs}
                onResolve={(status) => onResolve(a.id, status)}
                onDelete={() => onDelete(a.id)}
              />
            ))}
          </Section>
        ))
      )}

      {completed.length > 0 && (
        <CompletedToday items={completed} courseById={courseById} onUndo={onUndo} />
      )}
    </Card>
  )
}

function Section({
  label,
  tone,
  divider = false,
  children,
}: {
  label: React.ReactNode
  tone: 'danger' | 'muted'
  divider?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={cn(divider && 'border-t border-border')}>
      <p
        className={cn(
          'px-4 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide uppercase',
          tone === 'danger' ? 'text-danger' : 'text-subtle',
        )}
      >
        {label}
      </p>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <CheckCircle2 size={26} aria-hidden />
      </span>
      <h3 className="font-display text-xl font-medium text-fg">All caught up</h3>
      <p className="max-w-xs text-sm text-muted">
        Nothing outstanding right now. Enjoy the breathing room — new deadlines show up
        here the moment they land.
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
  const hex = course ? courseColor(course.color).hex : undefined
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtle">
          <StatusBadge status={assessment.status} />
          {course && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
              {course.code}
            </span>
          )}
          <span
            className={cn(
              'truncate text-[13px] text-muted',
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
