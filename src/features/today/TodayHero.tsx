import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, ChevronRight, GraduationCap, ListTodo } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { PHOTOS } from '@/data/resource-photos'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { ModalShell } from '@/command/ModalShell'
import { cn } from '@/lib/cn'

/** One line in a chip's list: an assessment or a task, already described. */
export interface HeroItem {
  id: string
  title: string
  /** Class code and kind, or where a task came from. */
  sub: string
  due: string
  /** The class's colour, when it has a class. */
  hex?: string
  onOpen: () => void
}

const CHIP = 'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors duration-150'
const GLASS = 'bg-white/[0.12] backdrop-blur-md hover:bg-white/[0.22]'

/**
 * PREVIEW. The banner on Today, in the same family as Courses and the Planner:
 * a campus photo under a dark wash, the greeting as the headline, and the three
 * things you open Today to learn as chips (what is late, what is left, what is
 * next), with the term GPA beside them.
 *
 * Every chip is a way in: the two counts open the list they are counting, and
 * "Next" goes to that assessment on its class page.
 */
export function TodayHero({
  date,
  greeting,
  overdue,
  week,
  next,
  nextCourse,
  gpa,
}: {
  date: string
  greeting: string
  overdue: HeroItem[]
  /** Everything open and due within the week, late items included. */
  week: HeroItem[]
  next: Assessment | null
  nextCourse?: Course
  gpa: number | null
}) {
  const [list, setList] = useState<'overdue' | 'week' | null>(null)
  const items = list === 'overdue' ? overdue : week

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
          <div className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
            {overdue.length > 0 && (
              <button type="button" onClick={() => setList('overdue')} className={cn(CHIP, 'bg-[#e5484d] font-semibold hover:bg-[#f0585d]')}>
                <AlertTriangle size={13} aria-hidden /> {overdue.length} overdue
              </button>
            )}
            {week.length === 0 ? (
              <span className={cn(CHIP, 'bg-white/[0.12] font-semibold backdrop-blur-md')}>
                <ListTodo size={13} className="text-white/70" aria-hidden /> Nothing left this week
              </span>
            ) : (
              <button type="button" onClick={() => setList('week')} className={cn(CHIP, GLASS)}>
                <ListTodo size={13} className="text-white/70" aria-hidden />
                <span className="font-semibold tabular-nums">{week.length}</span>
                <span className="text-white/75">to do this week</span>
              </button>
            )}
            {next && (
              <Link to={`/app/courses/${next.courseId}`} state={{ focus: next.id }} className={cn(CHIP, GLASS)}>
                <CalendarClock size={13} className="shrink-0 text-white/70" aria-hidden />
                <span className="text-white/75">Next:</span>
                <span className="truncate font-semibold">
                  {nextCourse?.code ? `${nextCourse.code} · ` : ''}
                  {next.title}
                </span>
                <span className="shrink-0 text-white/75">{relativeDueLabel(next.due).replace(/^Due /, '')}</span>
              </Link>
            )}
          </div>
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

      {list && (
        <ModalShell label={list === 'overdue' ? 'Overdue' : 'To do this week'} onClose={() => setList(null)} widthClass="sm:max-w-lg">
          <div className="p-5 text-fg">
            <h2 className="font-display text-[20px] font-semibold tracking-tight">
              {list === 'overdue' ? `${items.length} overdue` : `${items.length} to do this week`}
            </h2>
            <p className="mt-1 text-[13px] text-muted">Pick one to open it.</p>
            <ul className="mt-4 space-y-2">
              {items.map((it) => {
                const late = daysUntil(it.due) < 0
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => {
                        // Close first, so the editor never stacks on this list.
                        setList(null)
                        it.onOpen()
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-canvas/60 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
                    >
                      <span className="h-9 w-1 shrink-0 rounded-full bg-subtle" style={it.hex ? { backgroundColor: it.hex } : undefined} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{it.title || 'Untitled'}</span>
                        <span className="block truncate text-[12.5px] text-muted">{it.sub}</span>
                      </span>
                      <span className={cn('shrink-0 text-[12.5px] font-semibold', late ? 'text-danger' : 'text-muted')}>{relativeDueLabel(it.due)}</span>
                      <ChevronRight size={15} className="shrink-0 text-subtle" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </ModalShell>
      )}
    </header>
  )
}
