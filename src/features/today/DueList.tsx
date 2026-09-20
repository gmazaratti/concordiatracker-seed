import { useState } from 'react'
import { byDue, daysUntil } from '@/lib/date'
import { CheckCircle2, ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { Assessment, AssessmentStatus, CalendarTask, Course } from '@/data/types'
import type { TodayPrefs } from '@/app/providers/app-data'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/i18n'
import type { T } from '@/i18n/i18n'
import { DueRow } from './DueRow'
import { MoodleDueRow } from './MoodleDueRow'
import { CustomizeToday } from './CustomizeToday'
import type { DueGroups } from './due'

/**
 * A row on Today is one of two things.
 *
 * An ASSESSMENT is coursework: it has a weight, it can be graded, ticking it
 * sets a status. A MOODLE item is a deadline your professor posted that no
 * syllabus lists — "Join a Group (Due date)" — with no weight and nothing to
 * grade, where ticking it just crosses it off.
 *
 * They are kept as distinct kinds rather than dressing the second up as the
 * first, because a fake Assessment would be handed to `setStatus` and
 * `removeAssessment` with an id those tables have never heard of: a tick that
 * silently does nothing is worse than a row that is honest about what it is.
 *
 * A Moodle item that DUPLICATES an assessment never reaches here — TodayPage
 * drops it, so one piece of coursework is one row.
 */
export type DueEntry =
  | { kind: 'assessment'; id: string; due: string | null; item: Assessment }
  | { kind: 'moodle'; id: string; due: string; item: CalendarTask }

interface RowSection {
  key: string
  label: React.ReactNode
  tone: 'danger' | 'muted'
  items: DueEntry[]
}

/** Assessments and Moodle deadlines in one date order. */
function merge(assessments: Assessment[], moodle: CalendarTask[]): DueEntry[] {
  const rows: DueEntry[] = [
    ...assessments.map((a) => ({ kind: 'assessment' as const, id: a.id, due: a.due, item: a })),
    ...moodle.map((m) => ({ kind: 'moodle' as const, id: m.id, due: m.due, item: m })),
  ]
  return rows.sort((x, y) => {
    if (!x.due) return 1
    if (!y.due) return -1
    return x.due.localeCompare(y.due)
  })
}

/** Which time bucket a Moodle deadline belongs in — the same horizons `due.ts`
 *  uses for assessments, so the two kinds cannot disagree about "this week". */
function bucketMoodle(tasks: CalendarTask[]): {
  overdue: CalendarTask[]
  thisWeek: CalendarTask[]
  later: CalendarTask[]
} {
  const overdue: CalendarTask[] = []
  const thisWeek: CalendarTask[] = []
  const later: CalendarTask[] = []
  for (const m of tasks) {
    const d = daysUntil(m.due)
    if (d < 0) overdue.push(m)
    else if (d < 7) thisWeek.push(m)
    else later.push(m)
  }
  return { overdue, thisWeek, later }
}

/** Sections for the active list, per the "Group by" preference: time buckets
 * (overdue / this week) or one section per course (soonest-due course first). */
function buildSections(
  t: T,
  groups: DueGroups,
  moodle: CalendarTask[],
  groupBy: TodayPrefs['groupBy'],
  courseById: (id: string) => Course | undefined,
): RowSection[] {
  if (groupBy === 'course') {
    const map = new Map<string, DueEntry[]>()
    for (const a of [...groups.active, ...groups.later, ...groups.undated].sort(byDue)) {
      const arr = map.get(a.courseId) ?? []
      arr.push({ kind: 'assessment', id: a.id, due: a.due, item: a })
      map.set(a.courseId, arr)
    }
    const sections = [...map.entries()]
      .sort((x, y) => (x[1][0].due ?? '').localeCompare(y[1][0].due ?? ''))
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
              {course?.code ?? t('today.course')}
            </span>
          ),
        }
      })
    // Grouping by COURSE cannot place a Moodle deadline: these are the ones
    // that matched no assessment, so we do not know which class they belong
    // to with enough confidence to file them under one. Their own group is
    // honest; guessing a course would not be.
    if (moodle.length) {
      sections.push({
        key: 'moodle',
        tone: 'muted' as const,
        items: merge([], moodle),
        label: <span className="inline-flex items-center gap-1.5">From Moodle</span>,
      })
    }
    return sections
  }

  const m = bucketMoodle(moodle)
  const out: RowSection[] = []
  const add = (key: string, label: React.ReactNode, tone: 'danger' | 'muted', items: DueEntry[]) => {
    if (items.length) out.push({ key, label, tone, items })
  }
  add('overdue', t('today.overdue'), 'danger', merge(groups.overdue, m.overdue))
  add('thisweek', t('today.thisWeek'), 'muted', merge(groups.thisWeek, m.thisWeek))
  add('later', t('today.comingUp'), 'muted', merge(groups.later, m.later))
  // Last, always, and in its own section rather than the bottom of "Coming up".
  // These are not late and they are not soon — they are unscheduled, which is a
  // different problem with a different fix, and burying them in a time bucket
  // would imply a date we do not have.
  add('undated', t('today.noDateYet'), 'muted', merge(groups.undated, []))
  return out
}

export function DueList({
  groups,
  moodle,
  completed,
  prefs,
  compact = false,
  courseById,
  onResolve,
  onDelete,
  onUndo,
  onToggleMoodle,
  onPrefsChange,
}: {
  groups: DueGroups
  /** Rendered in the 272px side rail rather than the wide column: fewer rows
   *  before the fold and a shorter scroll window, since the card is a third
   *  of the width. */
  compact?: boolean
  /** Moodle deadlines that are NOT already on screen as an assessment. */
  moodle: CalendarTask[]
  completed: Assessment[]
  prefs: TodayPrefs
  courseById: (id: string) => Course | undefined
  onResolve: (id: string, status: AssessmentStatus) => void
  onDelete: (id: string) => void
  onUndo: (id: string) => void
  onToggleMoodle: (id: string) => void
  onPrefsChange: (patch: Partial<TodayPrefs>) => void
}) {
  const t = useT()
  const [customizeOpen, setCustomizeOpen] = useState(false)
  // Long sections (a pile of overdue, say) collapse past this — the list stays
  // one calm screen and the rest sits behind "Show N more".
  const CAP = compact ? 3 : 5
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const sections = buildSections(t, groups, moodle, prefs.groupBy, courseById)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-wide text-fg uppercase">{t('today.due')}</h2>
        <div className="flex items-center gap-1.5">
          {groups.total > 0 && (
            <span className="text-[12px] text-subtle">
              {groups.total} {groups.total === 1 ? t('today.itemOne') : t('today.itemMany')}
            </span>
          )}
          <button
            type="button"
            data-tour="customize"
            onClick={() => setCustomizeOpen((o) => !o)}
            aria-expanded={customizeOpen}
            aria-label={t('today.customizeToday')}
            title={t('today.customizeToday')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
              customizeOpen && 'bg-surface-2 text-fg',
            )}
          >
            <SlidersHorizontal size={14} aria-hidden />
            <span className="hidden sm:inline">{t('today.customize')}</span>
          </button>
        </div>
      </div>

      {customizeOpen && <CustomizeToday prefs={prefs} onChange={onPrefsChange} />}

      {sections.length === 0 ? (
        <EmptyState />
      ) : (
        sections.map((section, i) => {
          const isOpen = expanded.has(section.key)
          const visible = isOpen ? section.items : section.items.slice(0, CAP)
          const hiddenCount = section.items.length - visible.length
          return (
            <Section
              key={section.key}
              label={section.label}
              tone={section.tone}
              divider={i > 0}
              scroll={isOpen}
              compact={compact}
            >
              {/* EXPANDING USED TO GROW THE PAGE.
                  Fourteen overdue items turned "Show 9 more" into a card
                  taller than the screen, which pushed everything under it —
                  the announcements, the widgets — out of reach and made the
                  rail scroll past its own content. Opening now hands the
                  section a scroll window instead: the card keeps its height,
                  the rest of the page stays where it was, and the extra rows
                  are a flick away rather than a page scroll away. */}
              {visible.map((row) =>
                row.kind === 'assessment' ? (
                  <DueRow
                    key={row.id}
                    assessment={row.item}
                    course={courseById(row.item.courseId)}
                    prefs={prefs}
                    onResolve={(status) => onResolve(row.id, status)}
                    onDelete={() => onDelete(row.id)}
                  />
                ) : (
                  <MoodleDueRow
                    key={row.id}
                    task={row.item}
                    prefs={prefs}
                    onToggle={() => onToggleMoodle(row.id)}
                  />
                ),
              )}
              {(hiddenCount > 0 || (isOpen && section.items.length > CAP)) && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(section.key)}
                  className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[12.5px] font-medium text-accent transition-colors duration-150 hover:bg-surface-2/50"
                >
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
                    aria-hidden
                  />
                  {isOpen
                    ? t('today.showFewer')
                    : t('today.showMore', { count: hiddenCount })}
                </button>
              )}
            </Section>
          )
        })
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
  scroll = false,
  compact = false,
  children,
}: {
  label: React.ReactNode
  tone: 'danger' | 'muted'
  divider?: boolean
  /** Expanded: bound the height and scroll inside instead of growing. */
  scroll?: boolean
  compact?: boolean
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
      <ul
        className={cn(
          'divide-y divide-border',
          // `overscroll-contain` so reaching the end of the section does not
          // hand the gesture to the page and jump you somewhere else.
          scroll && 'overscroll-contain overflow-y-auto',
          // A ROW COUNT, not a viewport fraction. `60vh` measured shorter
          // than the five rows the section was already showing on a laptop,
          // so expanding made the card SMALLER — which is a strange thing for
          // "Show 6 more" to do. 22rem is comfortably taller than five rows
          // at either density, so opening always reveals.
          scroll && (compact ? 'max-h-[15rem]' : 'max-h-[22rem]'),
        )}
      >
        {children}
      </ul>
    </section>
  )
}

function EmptyState() {
  const t = useT()
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <CheckCircle2 size={26} aria-hidden />
      </span>
      <h3 className="font-display text-xl font-medium text-fg">{t('today.allCaughtUp')}</h3>
      <p className="max-w-xs text-sm text-muted">
        {t('today.allCaughtUpSub')}
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
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12px] text-subtle transition-colors duration-150 hover:text-muted"
      >
        <span>{t('today.completedTodayCount', { count: items.length })}</span>
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
  const t = useT()
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
        {t('today.undo')}
      </button>
    </li>
  )
}
