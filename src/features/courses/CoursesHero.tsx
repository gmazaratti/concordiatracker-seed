import type { ReactNode } from 'react'
import { AlertTriangle, BookOpenCheck, GraduationCap, ListTodo } from 'lucide-react'
import { PHOTOS } from '@/data/resource-photos'

/**
 * The banner on Courses, in the same family as the Planner's: a campus photo
 * under a dark wash, the term GPA as the headline (or the class count until a
 * grade exists), the term's counts as chips, and the page's actions on the
 * right.
 */
export function CoursesHero({
  eyebrow,
  gpa,
  classes,
  credits,
  graded,
  open,
  overdue,
  actions,
}: {
  eyebrow: string
  gpa: number | null
  classes: number
  credits: number
  graded: number
  open: number
  overdue: number
  actions: ReactNode
}) {
  return (
    <header className="ct-res-in relative isolate overflow-hidden rounded-3xl bg-[#0b0d16] text-white">
      <img src={PHOTOS.hall.src} alt={PHOTOS.hall.alt} className="ct-res-kenburns absolute inset-0 -z-20 size-full object-cover grayscale" />
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
          <h1 className="text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">{eyebrow}</h1>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="font-display text-[60px] leading-[0.9] font-bold tabular-nums sm:text-[76px]">
              {gpa === null ? classes : gpa.toFixed(2)}
            </span>
            <span className="pb-1.5 text-[15px] text-white/80">
              {gpa === null
                ? `${classes === 1 ? 'class' : 'classes'} this term. Enter a grade to see your GPA.`
                : 'term GPA so far'}
            </span>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
            <Chip icon={BookOpenCheck} n={credits} label="credits" />
            <Chip icon={GraduationCap} n={`${graded} of ${classes}`} label="classes graded" />
            <Chip icon={ListTodo} n={open} label="still to hand in" />
            {overdue > 0 && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-[#e5484d] px-3 py-1.5 font-semibold">
                <AlertTriangle size={13} aria-hidden /> {overdue} overdue
              </li>
            )}
          </ul>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
      </div>
    </header>
  )
}

function Chip({ icon: Icon, n, label }: { icon: typeof ListTodo; n: number | string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
      <Icon size={13} className="text-white/70" aria-hidden />
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-white/75">{label}</span>
    </li>
  )
}
