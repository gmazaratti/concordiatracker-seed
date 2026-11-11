import { AlertTriangle, CalendarClock, GraduationCap, ListTodo } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { PHOTOS } from '@/data/resource-photos'
import { relativeDueLabel } from '@/lib/date'

/**
 * PREVIEW. The banner on Today, in the same family as Courses and the Planner:
 * a campus photo under a dark wash, the greeting as the headline, and the three
 * things you open Today to learn as chips (what is left, what is late, what is
 * next), with the term GPA beside them.
 */
export function TodayHero({
  date,
  greeting,
  left,
  overdue,
  next,
  nextCourse,
  gpa,
}: {
  date: string
  greeting: string
  /** Open items due this week, late ones included. */
  left: number
  overdue: number
  next: Assessment | null
  nextCourse?: Course
  gpa: number | null
}) {
  return (
    <header className="ct-res-in relative isolate mb-5 overflow-hidden rounded-3xl bg-[#0b0d16] text-white">
      <img src={PHOTOS.quad.src} alt={PHOTOS.quad.alt} className="ct-res-kenburns absolute inset-0 -z-20 size-full object-cover grayscale" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(100deg, rgba(8,10,20,0.95) 0%, rgba(8,10,20,0.85) 42%, rgba(8,10,20,0.45) 78%, rgba(8,10,20,0.3) 100%), linear-gradient(0deg, rgba(8,10,20,0.7), transparent 45%)',
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">{date}</p>
          <h1 className="mt-2 font-display text-[34px] leading-[1.02] font-bold tracking-tight text-balance sm:text-[48px]">{greeting}</h1>
          <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
            {overdue > 0 && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-[#e5484d] px-3 py-1.5 font-semibold">
                <AlertTriangle size={13} aria-hidden /> {overdue} overdue
              </li>
            )}
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
              <ListTodo size={13} className="text-white/70" aria-hidden />
              {left === 0 ? (
                <span className="font-semibold">Nothing left this week</span>
              ) : (
                <>
                  <span className="font-semibold tabular-nums">{left}</span>
                  <span className="text-white/75">to do this week</span>
                </>
              )}
            </li>
            {next && (
              <li className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
                <CalendarClock size={13} className="shrink-0 text-white/70" aria-hidden />
                <span className="text-white/75">Next:</span>
                <span className="truncate font-semibold">
                  {nextCourse?.code ? `${nextCourse.code} · ` : ''}
                  {next.title}
                </span>
                <span className="shrink-0 text-white/75">{relativeDueLabel(next.due).replace(/^Due /, '')}</span>
              </li>
            )}
          </ul>
        </div>
        {gpa !== null && (
          <div className="shrink-0 sm:text-right">
            <p className="font-display text-[56px] leading-[0.9] font-bold tabular-nums sm:text-[72px]">{gpa.toFixed(2)}</p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[14px] font-medium text-white/85">
              <GraduationCap size={15} aria-hidden /> term GPA so far
            </p>
          </div>
        )}
      </div>
    </header>
  )
}
