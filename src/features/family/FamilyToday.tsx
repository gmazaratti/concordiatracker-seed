import { useState } from 'react'
import { Check, Eye, Lock } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { courseColor } from '@/lib/course-color'
import { currentGpa, percentToGrade } from '@/lib/gpa'
import { gradeToPercent } from '@/lib/grade'
import { relativeDueLabel } from '@/lib/date'
import { isOpen } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { cn } from '@/lib/cn'
import type { FamilyData } from './family-data'

const DAY = 86_400_000

/**
 * The student's Today, as a parent sees it: the same due list, the same glance
 * panel, the same numbers. View only: nothing can be ticked, edited or added,
 * and that is said once at the top rather than by disabled buttons everywhere.
 */
export function FamilyToday({ data }: { data: FamilyData }) {
  const [now] = useState(() => Date.now())
  const first = data.name.split(/\s+/)[0]
  const course = (id: string) => data.courses.find((c) => c.id === id)
  const live = data.assessments.filter((a) => course(a.courseId))
  const open = live.filter((a) => isOpen(a.status))
  const overdue = open.filter((a) => a.due && new Date(a.due).getTime() < now).sort(byDue)
  const week = open.filter((a) => a.due && new Date(a.due).getTime() >= now && new Date(a.due).getTime() < now + 7 * DAY).sort(byDue)
  const later = open.filter((a) => a.due && new Date(a.due).getTime() >= now + 7 * DAY).sort(byDue).slice(0, 6)
  const doneToday = live.filter((a) => !isOpen(a.status) && a.due && Math.abs(new Date(a.due).getTime() - now) < 3 * DAY)

  const termGpa = data.grades ? currentGpa(data.courses, data.assessments) : null
  const cumGpa = data.grades ? currentGpa([...data.pastCourses, ...data.courses], data.assessments) : null
  const next = week[0] ?? later[0]
  const credits = data.courses.reduce((n, c) => n + (c.credits || 0), 0)
  const today = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(now))

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <header className="mb-3">
        <p className="text-[12px] text-subtle">{today}</p>
        <h1 className="mt-0.5 font-display text-[26px] font-semibold text-fg sm:text-[30px]">{first}’s week</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-subtle">
          <Eye size={13} aria-hidden /> View only. {first} decides what is shared and can end it any time.
        </p>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <main className="min-w-0 flex-1">
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
              <p className="text-[13px] font-semibold text-fg">Due</p>
              <p className="text-[12px] text-subtle">{overdue.length + week.length + later.length} items</p>
            </div>
            {overdue.length + week.length + later.length === 0 ? (
              <p className="px-4 py-10 text-center text-[14px] text-subtle">Nothing due right now.</p>
            ) : (
              <>
                <Group now={now} label="Overdue" tone="danger" items={overdue} course={course} grades={data.grades} />
                <Group now={now} label="This week" items={week} course={course} grades={data.grades} />
                <Group now={now} label="Coming up" items={later} course={course} grades={data.grades} />
              </>
            )}
          </section>
          {overdue.length > 0 && (
            <p className="mt-2 px-1 text-[12px] text-subtle">Overdue means not ticked off yet. It may simply be handed in and not marked.</p>
          )}
          {doneToday.length > 0 && (
            <p className="mt-3 px-1 text-[12.5px] text-muted">
              <Check size={13} className="mr-1 inline text-success" aria-hidden />
              {doneToday.length} recently finished
            </p>
          )}
        </main>

        <aside className="flex flex-col gap-3 lg:w-[272px] lg:shrink-0">
          <div className="rounded-xl border border-border/60 bg-surface/50 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">At a glance</p>
            <dl className="mt-3 space-y-3 text-[13px]">
              <Row label="This term’s GPA">
                {data.grades ? (termGpa !== null ? termGpa.toFixed(2) : '—') : <Hidden />}
                {data.grades && cumGpa !== null && <span className="block text-[11px] font-normal text-subtle">Cumulative {cumGpa.toFixed(2)}</span>}
              </Row>
              <Row label="Overdue">
                <span className={overdue.length ? 'text-danger' : ''}>{overdue.length}</span>
              </Row>
              <Row label="Due this week">{week.length}</Row>
              <Row label="Next up">
                {next ? relativeDueLabel(next.due) : '—'}
                {next && <span className="block truncate text-[11px] font-normal text-subtle">{course(next.courseId)?.code} · {next.title}</span>}
              </Row>
              <Row label="This term">
                {data.courses.length} course{data.courses.length === 1 ? '' : 's'}
                <span className="block text-[11px] font-normal text-subtle">{credits} credits</span>
              </Row>
            </dl>
          </div>
          {!data.grades && (
            <p className="flex items-start gap-2 rounded-xl border border-border/60 px-3.5 py-3 text-[12.5px] text-subtle">
              <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
              Grades are not shared. {first} can turn them on in Settings, Family.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function byDue(a: Assessment, b: Assessment) {
  return (a.due ?? '').localeCompare(b.due ?? '')
}

function Hidden() {
  return (
    <span className="inline-flex items-center gap-1 font-normal text-subtle">
      <Lock size={11} aria-hidden /> Not shared
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold text-fg">{children}</dd>
    </div>
  )
}

/** A due-list section, rows shaped like Today's DueRow but read-only. */
export function Group({
  label,
  tone,
  items,
  course,
  grades,
  now,
}: {
  label: string
  tone?: 'danger'
  items: Assessment[]
  course: (id: string) => Course | undefined
  grades: boolean
  now: number
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className={cn('px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase', tone === 'danger' ? 'text-danger' : 'text-subtle')}>{label}</p>
      <ul className="divide-y divide-border/60">
        {items.map((a) => {
          const c = course(a.courseId)
          const due = relativeDueLabel(a.due)
          const urgent = a.due && new Date(a.due).getTime() < now + DAY
          const pct = grades ? gradeToPercent(a.grade) : null
          return (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-full border-2', isOpen(a.status) ? 'border-border-strong' : 'border-accent bg-accent text-accent-contrast')} aria-hidden>
                {!isOpen(a.status) && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-fg">{a.title}</span>
                <span className="flex items-center gap-1.5 text-[12px] text-subtle">
                  {c && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: courseColor(c.color).hex }} aria-hidden />}
                  <span className="truncate">
                    {c?.code} · {KIND_LABEL[a.kind]} · {a.weight}%
                  </span>
                </span>
              </span>
              {pct !== null ? (
                <span className="shrink-0 text-[13px] font-semibold text-fg">
                  {Math.round(pct)}% {percentToGrade(pct).letter}
                </span>
              ) : (
                <span className={cn('w-[104px] shrink-0 text-right text-[13px] font-semibold', tone === 'danger' ? 'text-danger' : urgent ? 'text-warning' : 'text-fg')}>{due}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
