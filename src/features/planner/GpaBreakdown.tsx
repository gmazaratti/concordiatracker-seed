import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { currentGpa, gpaLines } from '@/lib/gpa'
import { cn } from '@/lib/cn'

/**
 * The GPA, shown as arithmetic rather than asserted.
 *
 * When our number disagrees with the registrar's, the disagreement is always a
 * specific course: a grade typed wrong, a credit count off, a missing term, or
 * a rule we apply differently. Printing every line lets that be found in
 * seconds instead of argued about, and it is the same discipline as the
 * per-course "How is this calculated?" panel: the formula and the number come
 * from one function, so they cannot drift apart.
 */
export function GpaBreakdown({
  pastCourses,
  assessments,
}: {
  pastCourses: Course[]
  assessments: Assessment[]
}) {
  const [open, setOpen] = useState(false)
  const lines = useMemo(() => gpaLines(pastCourses, assessments), [pastCourses, assessments])
  const gpa = useMemo(() => currentGpa(pastCourses, assessments), [pastCourses, assessments])

  const counted = lines.filter((l) => l.percent !== null && !l.superseded)
  const credits = counted.reduce((sum, l) => sum + l.credits, 0)
  const points = counted.reduce((sum, l) => sum + l.points * l.credits, 0)

  if (lines.length === 0) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        <ChevronDown size={13} aria-hidden className={cn(open && 'rotate-180')} />
        How this GPA is calculated
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
          <p className="border-b border-border px-4 py-2.5 text-[12px] leading-relaxed text-subtle">
            Each course contributes its grade points multiplied by its credits. The total is divided
            by the credits counted. Concordia counts only the latest attempt of a repeated course,
            so an earlier attempt is listed here but excluded.
          </p>

          <ul className="divide-y divide-border/60">
            {lines.map((l) => (
              <li
                key={l.course.id}
                className={cn(
                  'grid grid-cols-[1fr_auto] gap-x-3 px-4 py-1.5 text-[12px] sm:grid-cols-[1fr_60px_54px_54px_70px]',
                  (l.percent === null || l.superseded) && 'text-subtle',
                )}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-fg">{l.course.code}</span>
                  <span className="ml-2 text-subtle">{l.course.term}</span>
                </span>
                <span className="hidden text-right tabular-nums sm:block">
                  {l.percent === null ? '—' : (l.course.finalLetter ?? l.letter)}
                </span>
                <span className="hidden text-right tabular-nums sm:block">
                  {l.percent === null ? '—' : l.points.toFixed(2)}
                </span>
                <span className="hidden text-right tabular-nums sm:block">{l.credits} cr</span>
                <span className="text-right font-medium tabular-nums">
                  {l.superseded ? 'excluded' : l.percent === null ? 'ungraded' : (l.points * l.credits).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t border-border bg-surface-2 px-4 py-3 text-[12.5px]">
            <p className="flex justify-between text-fg">
              <span>Total grade points</span>
              <span className="font-medium tabular-nums">{points.toFixed(2)}</span>
            </p>
            <p className="mt-0.5 flex justify-between text-fg">
              <span>Credits counted</span>
              <span className="font-medium tabular-nums">{credits}</span>
            </p>
            <p className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-fg">
              <span className="font-medium">
                {points.toFixed(2)} ÷ {credits}
              </span>
              <span className="font-display text-[15px] font-semibold tabular-nums">
                {gpa === null ? '—' : gpa.toFixed(2)}
              </span>
            </p>
          </div>

          <p className="border-t border-border px-4 py-2.5 text-[11.5px] leading-relaxed text-subtle">
            If this does not match your record, compare it line by line: the difference is almost
            always one grade, one credit count, or a term that has not been entered.{' '}
            {lines.some((l) => l.percent === null) &&
              'Ungraded courses count for credits but not toward the GPA.'}
          </p>
        </div>
      )}
    </div>
  )
}
