import { useEffect, useRef, useState } from 'react'
import { courses, seedAssessments } from '@/data/mock'
import { courseStanding, gradeNeeded, GRADE_TARGETS } from '@/lib/gpa'
import { courseColor } from '@/lib/course-color'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/cn'
import { useDevCopy } from './copy'
import { useInView } from './useInView'

const COURSE_ID = 'comp248'
const course = courses.find((c) => c.id === COURSE_ID)
const items = seedAssessments.filter((a) => a.courseId === COURSE_ID)
const standing = courseStanding(items)
/** The four letters the demo steps through: the ones a real student argues about. */
const TARGETS = GRADE_TARGETS.filter((g) => ['A', 'A-', 'B+', 'B'].includes(g.letter)).reverse()

/**
 * The real grade-needed arithmetic (`lib/gpa.gradeNeeded`) over the seed's
 * COMP 248, not a mock-up of it. Once on screen it steps through the targets on
 * its own so the page is visibly doing maths; the first click hands control to
 * the visitor and the auto-play stops for good.
 */
export function MiniGrade() {
  const copy = useDevCopy()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref)
  const reduced = usePrefersReducedMotion()
  const [i, setI] = useState(1)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!seen || touched || reduced) return
    const id = window.setInterval(() => setI((n) => (n + 1) % TARGETS.length), 2400)
    return () => window.clearInterval(id)
  }, [seen, touched, reduced])

  const target = TARGETS[i]
  const result = gradeNeeded(items, target.min)
  const hex = courseColor(course?.color ?? 'blue').hex
  const total = standing.totalWeight || 100
  const graded = ((standing.totalWeight - standing.remainingWeight) / total) * 100

  return (
    <div ref={ref} className="absolute inset-0 flex flex-col justify-between p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <span className="size-2.5 rounded-full" style={{ background: hex }} aria-hidden />
          {course?.code}
        </span>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
          {copy.gradeFree}
        </span>
      </div>

      <div>
        <p className="text-[12px] text-subtle">{copy.gradeTarget}</p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={copy.gradeTarget}>
          {TARGETS.map((g, n) => (
            <button
              key={g.letter}
              type="button"
              aria-pressed={n === i}
              onClick={() => {
                setTouched(true)
                setI(n)
              }}
              className={cn(
                'min-w-11 rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition-colors duration-150',
                n === i
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border text-muted hover:border-border-strong hover:text-fg',
              )}
            >
              {g.letter}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite">
        <p className="text-[12px] text-subtle">{copy.gradeNeeded}</p>
        <p className="mt-1 font-display text-[clamp(2.4rem,5vw,3.4rem)] leading-none font-semibold tracking-[-0.03em] text-fg tabular-nums">
          {result.kind === 'needed' && `${result.percent.toFixed(1)}%`}
          {result.kind === 'secured' && copy.gradeSecured}
          {result.kind === 'unreachable' && copy.gradeUnreachable}
          {result.kind === 'no-remaining' && '·'}
        </p>
        {result.kind === 'needed' && (
          <p className="mt-1.5 text-[12.5px] text-muted">
            {copy.gradeOnRemaining.replace('{w}', String(result.remainingWeight))}
          </p>
        )}
      </div>

      {/* Graded vs still-to-come weight, in the course's own colour. */}
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span style={{ width: `${graded}%`, background: hex }} />
        <span
          className="transition-[width] duration-500 ease-out"
          style={{
            width: `${result.kind === 'needed' ? (standing.remainingWeight / total) * result.percent : 0}%`,
            background: hex,
            opacity: 0.35,
          }}
        />
      </div>
    </div>
  )
}
