import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronDown, CircleCheck, Hourglass, PenLine, Undo2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { Assessment, Course } from '@/data/types'
import { useQuickActions } from '@/app/providers/quick-actions'
import { CourseMark } from '@/components/CourseMark'
import { KIND_LABEL } from '@/lib/assessment'
import { askForGrade } from '@/lib/grade-prompt'
import { useT } from '@/i18n/i18n'

/**
 * "Handed in, no mark yet" — the middle state between due and done.
 *
 * It used to vanish from Today the moment it was set, because Today listed
 * OPEN work and awaiting-grade is not open. That lost the one thing a student
 * still has to do with it: come back and record the grade. So it keeps its own
 * quiet section at the bottom of the list.
 *
 * DELIBERATELY NOT COUNTED: the glance rail and the section counts read open
 * work only, so a submitted item never reads as "left to do". And nothing here
 * asks for a grade you do not have yet — the row just waits.
 *
 * Tapping the row opens the same editor as everywhere else. The two buttons are
 * the two ways it ends: record the grade (the same small card a check-off
 * offers), or mark it graded without typing one, which files it as done.
 */
export function AwaitingGrade({
  items,
  courseById,
  icons,
  onMarkGraded,
  onMarkNotDone,
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
  /** Take the tick back: it was not handed in after all. */
  onMarkNotDone: (id: string) => void
  items: Assessment[]
  courseById: (id: string) => Course | undefined
  icons: boolean
  onMarkGraded: (id: string) => void
}) {
  const t = useT()
  const { openAssessment } = useQuickActions()
  const navigate = useNavigate()
  if (items.length === 0) return null
  return (
    <section className="border-t border-border" aria-label={t('today.awaitingTitle')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className={cn(
          'flex w-full items-center gap-1.5 px-4 pt-3 pb-1.5 text-left text-[11px] font-semibold tracking-wide text-subtle uppercase transition-colors duration-150 hover:text-fg',
          collapsed && 'pb-3',
        )}
      >
        <ChevronDown
          size={13}
          className={cn('shrink-0 transition-transform duration-150', collapsed && '-rotate-90')}
          aria-hidden
        />
        <Hourglass size={12} aria-hidden />
        {t('today.awaitingTitle')}
        <span className="font-normal normal-case tracking-normal">· {items.length}</span>
      </button>
      {!collapsed && (
      <ul className="divide-y divide-border/60">
        {items.map((a) => {
          const course = courseById(a.courseId)
          return (
            <li key={a.id} className="flex items-start gap-3 px-3 py-2.5">
              {/* A different mark from the round check: a filled check on a soft
                  accent disc says "handed in", not "finished". */}
              <span
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success text-accent-contrast"
                title={t('today.awaitingBadge')}
              >
                <Check size={12} strokeWidth={3} aria-hidden />
              </span>
              <button
                type="button"
                onClick={() => openAssessment(a.id)}
                className="-my-1 min-w-0 flex-1 rounded-md py-1 text-left transition-colors duration-150 hover:bg-surface-2/40"
              >
                <span className="line-clamp-2 break-words text-[14px] leading-snug text-muted" title={a.title}>
                  {a.title || 'Untitled'}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-subtle">
                  {course && (
                    <span className="inline-flex items-center gap-1.5">
                      <CourseMark course={course} icons={icons} />
                      {course.code}
                    </span>
                  )}
                  <span>{KIND_LABEL[a.kind]}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-px font-medium text-accent">
                    <Hourglass size={10} aria-hidden />
                    {t('today.awaitingBadge')}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => askForGrade(a.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[12px] font-medium text-fg transition-colors duration-150 hover:border-accent"
                >
                  <PenLine size={12} aria-hidden />
                  {t('today.awaitingEnter')}
                </button>
                <DropdownMenu
                  ariaLabel={`More for ${a.title}`}
                  items={[
                    { id: 'grade', label: t('today.awaitingEnter'), icon: PenLine, onSelect: () => askForGrade(a.id) },
                    {
                      id: 'nograde',
                      label: t('today.awaitingGraded'),
                      icon: CircleCheck,
                      onSelect: () => onMarkGraded(a.id),
                    },
                    {
                      id: 'open',
                      label: t('today.openInCourse'),
                      icon: ArrowUpRight,
                      onSelect: () => navigate(`/app/courses/${a.courseId}`, { state: { focus: a.id } }),
                    },
                    {
                      id: 'undo',
                      label: t('today.markNotDone'),
                      icon: Undo2,
                      separated: true,
                      onSelect: () => onMarkNotDone(a.id),
                    },
                  ]}
                />
              </div>
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}
