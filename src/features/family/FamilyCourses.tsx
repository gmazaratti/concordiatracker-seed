import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { courseColor } from '@/lib/course-color'
import { courseBanner } from '@/lib/course-style'
import { courseFinalPercent, percentToGrade } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { cn } from '@/lib/cn'
import type { FamilyData } from './family-data'
import { useByCourse } from './family-data'
import { Group } from './FamilyToday'

/** The student's classes as the app's grid cards, read-only. */
export function FamilyCourses({ data }: { data: FamilyData }) {
  const byCourse = useByCourse(data.assessments)
  const [params] = useSearchParams()
  const [now] = useState(() => Date.now())
  const q = params.toString() ? `?${params}` : ''
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <h1 className="font-display text-[26px] font-semibold text-fg">Courses</h1>
      <p className="mt-1 text-[12.5px] text-subtle">{data.name.split(/\s+/)[0]}’s classes this term.</p>
      {data.courses.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-[14px] text-subtle">No courses yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((c) => {
            const items = byCourse.get(c.id) ?? []
            const pct = data.grades ? courseFinalPercent(c, data.assessments) : null
            const open = items.filter((a) => isOpen(a.status))
            const overdue = open.filter((a) => a.due && new Date(a.due).getTime() < now).length
            const banner = courseBanner(courseColor(c.color).hex, c.gradient)
            return (
              <Link key={c.id} to={`/family/courses/${c.id}${q}`} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow duration-150 hover:shadow-lg">
                <div className="px-4 pt-3.5 pb-4" style={{ backgroundImage: banner.backgroundImage }}>
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">{c.code}</span>
                  <h3 className="mt-1.5 truncate font-display text-[17px] font-medium text-white">{c.title}</h3>
                </div>
                <div className="flex flex-1 flex-col px-4 py-3">
                  {data.grades ? (
                    pct !== null ? (
                      <p>
                        <span className="text-[22px] leading-none font-semibold text-fg">{Math.round(pct)}%</span>
                        <span className="ml-1.5 text-[12px] font-medium text-muted">{percentToGrade(pct).letter}</span>
                      </p>
                    ) : (
                      <p className="text-[12px] text-subtle">Not graded yet</p>
                    )
                  ) : (
                    <p className="flex items-center gap-1 text-[12px] text-subtle">
                      <Lock size={11} aria-hidden /> Grades not shared
                    </p>
                  )}
                  <p className="mt-auto border-t border-border/70 pt-2.5 text-[12px] text-muted">
                    {open.length} open{overdue > 0 && <span className="text-danger"> · {overdue} overdue</span>}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** One class: its details and every assessment, read-only. */
export function FamilyCourse({ data }: { data: FamilyData }) {
  const { courseId } = useParams()
  const [params] = useSearchParams()
  const byCourse = useByCourse(data.assessments)
  const [now] = useState(() => Date.now())
  const c = data.courses.find((x) => x.id === courseId)
  const q = params.toString() ? `?${params}` : ''
  if (!c) return <p className="p-6 text-[14px] text-subtle">This course is not shared.</p>
  const items = [...(byCourse.get(c.id) ?? [])].sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'))
  const pct = data.grades ? courseFinalPercent(c, data.assessments) : null
  const banner = courseBanner(courseColor(c.color).hex, c.gradient)
  const facts = [
    ['Section', c.section],
    ['Instructor', c.instructor?.name],
    ['Meets', c.meetingTimes],
    ['Room', c.location],
    ['Credits', String(c.credits)],
  ].filter(([, v]) => v)
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <Link to={`/family/courses${q}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={15} aria-hidden /> Courses
      </Link>
      <div className="mt-3 rounded-2xl px-5 py-5" style={{ backgroundImage: banner.backgroundImage }}>
        <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold text-white">{c.code}</span>
        <h1 className="mt-1.5 font-display text-[24px] font-semibold text-white">{c.title}</h1>
        {pct !== null && (
          <p className="mt-1 text-[15px] font-semibold text-white">
            {Math.round(pct)}% · {percentToGrade(pct).letter}
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="rounded-xl border border-border bg-surface p-4 lg:w-[280px] lg:shrink-0">
          <dl className="space-y-2 text-[13px]">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
        <section className={cn('min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface')}>
          <p className="border-b border-border px-4 py-2.5 text-[13px] font-semibold text-fg">Assessments</p>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-subtle">No assessments yet.</p>
          ) : (
            <Group now={now} label="All" items={items} course={() => c} grades={data.grades} />
          )}
        </section>
      </div>
    </div>
  )
}
