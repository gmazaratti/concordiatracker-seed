import { CalendarX2 } from 'lucide-react'
import type { Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { daysUntil } from '@/lib/date'
import { cn } from '@/lib/cn'
import { deadlineList, deadlinesForCourse } from '@/lib/section-deadlines'
import { useDeadlineRows } from '@/lib/section-deadlines-data'
import { DEADLINES_SOURCE } from './deadline-labels'

/**
 * The add / refund (DNE) / withdrawal (DISC) deadlines for THIS course's
 * section, from the registrar's term-dates page (mirrored daily).
 *
 * These are the most expensive dates a student can miss: DNE is the last day
 * to drop for a full refund, DISC the last day to withdraw without a failing
 * grade. A non-standard section has its own, and the generic term dates look
 * just as official, so the card says which set it is showing.
 *
 * Says nothing rather than something wrong: no matching row, no card; a
 * course whose section we do not know (when some sections differ) gets a
 * prompt to add it, never the standard dates.
 */
const LABEL = {
  registration: 'Last day to add',
  dne: 'Last day to drop for a refund (DNE)',
  disc: 'Last day to withdraw (DISC)',
} as const

export function SectionDeadlinesCard({ course }: { course: Course }) {
  const rows = useDeadlineRows()
  const match = course.term ? deadlinesForCourse(course, rows) : null
  if (!match) return null

  if (match.kind === 'needsSection') {
    if (course.archived) return null
    return (
      <Card className="overflow-hidden">
        <Header />
        <p className="px-3.5 py-3 text-[12px] leading-relaxed text-subtle">
          Some sections of {course.code} have their own drop and withdrawal deadlines. Add your
          section in the class details to see yours.
        </p>
      </Card>
    )
  }

  const dates = deadlineList(match.row)
  if (dates.length === 0) return null
  // A finished course whose deadlines are all behind it has nothing to say.
  if (course.archived && dates.every((d) => daysUntil(d.date) < 0)) return null
  const nextKey = dates.find((d) => daysUntil(d.date) >= 0)?.key

  return (
    <Card className="overflow-hidden">
      <Header />
      <ul className="divide-y divide-border/60">
        {dates.map((d) => {
          const days = daysUntil(d.date)
          const passed = days < 0
          const label =
            d.key === 'dne' && match.row.registration === match.row.dne ? 'Last day to add, or drop for a refund (DNE)' : LABEL[d.key]
          return (
            <li key={d.key} className={cn('flex items-baseline gap-3 px-3.5 py-2.5', d.key === nextKey && 'bg-accent-soft/40')}>
              <span className={cn('min-w-0 flex-1 text-[12.5px] leading-snug', passed ? 'text-subtle' : 'text-fg')}>
                {label}
              </span>
              <span className="shrink-0 text-right">
                <span className={cn('block text-[12.5px] font-semibold tabular-nums', passed ? 'text-subtle line-through' : 'text-fg')}>
                  {new Date(`${d.date}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className={cn('block text-[11px]', passed ? 'text-subtle' : days <= 7 ? 'text-warning' : 'text-subtle')}>
                  {passed ? 'Passed' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-border/60 px-3.5 py-2 text-[11px] leading-snug text-subtle">
        {match.kind === 'section'
          ? `Section ${match.row.section} has its own dates, published by the registrar.`
          : `Standard dates for ${match.row.session.replace(/\s*\(.*\)$/, '')}, published by the registrar.`}{' '}
        <a href={DEADLINES_SOURCE} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fg">
          Source
        </a>
      </p>
    </Card>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
      <CalendarX2 size={13} className="text-subtle" aria-hidden />
      <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Drop deadlines</p>
    </div>
  )
}
