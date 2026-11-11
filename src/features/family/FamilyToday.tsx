import { useState } from 'react'
import { Check, Eye, Lock } from 'lucide-react'
import type { Assessment } from '@/data/types'
import { currentGpa } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { Group } from './FamilyRows'
import { dueLabel, splitTitle } from './family-format'
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
              <p className="text-[12px] text-subtle">{week.length} this week</p>
            </div>
            {overdue.length + week.length + later.length === 0 ? (
              <p className="px-4 py-10 text-center text-[14px] text-subtle">Nothing due right now.</p>
            ) : (
              <>
                {/* Due soonest first: what is coming matters more to a parent than
                    a backlog that may simply not have been ticked off. */}
                <Group now={now} label="This week" items={week} course={course} grades={data.grades} />
                <Group now={now} label="Coming up" items={later} course={course} grades={data.grades} limit={4} />
                <Group
                  now={now}
                  label="Past due"
                  hint="Not marked done yet. It may be handed in."
                  tone="danger"
                  items={[...overdue].reverse()}
                  course={course}
                  grades={data.grades}
                  limit={3}
                />
              </>
            )}
          </section>
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
              <Row label="Past due">
                <span className={overdue.length ? 'text-danger' : ''}>{overdue.length}</span>
              </Row>
              <Row label="Due this week">{week.length}</Row>
              <div className="border-t border-border/60 pt-3">
                <dt className="text-muted">Next up</dt>
                {next ? (
                  <dd className="mt-1 min-w-0">
                    <span className="block truncate font-semibold text-fg">{splitTitle(next.title).name}</span>
                    <span className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-subtle">
                      <span className="truncate">{course(next.courseId)?.code}</span>
                      <span className="shrink-0 font-medium text-warning">{dueLabel(next.due, now).text}</span>
                    </span>
                  </dd>
                ) : (
                  <dd className="mt-1 text-subtle">Nothing coming up</dd>
                )}
              </div>
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
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-fg">{children}</dd>
    </div>
  )
}
