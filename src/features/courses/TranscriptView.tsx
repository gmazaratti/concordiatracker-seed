import { useMemo, useState } from 'react'
import { GraduationCap, Plus, Undo2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { currentGpa, percentToGrade, termRecords } from '@/lib/gpa'
import { sortTermsDesc } from '@/lib/term'
import { COURSE_COLORS } from '@/lib/course-color'
import { Button } from '@/components/ui/Button'
import { AddPastCourseModal } from './AddPastCourseModal'
import { cn } from '@/lib/cn'

/** Past semesters — a transcript: each finished term with its courses, letter
 * grades and term GPA, plus the cumulative GPA across everything graded. */
export function TranscriptView() {
  const { pastCourses, assessments, unarchiveCourse } = useAppData()
  const [adding, setAdding] = useState(false)

  const terms = useMemo(
    () => termRecords(pastCourses, assessments, sortTermsDesc),
    [pastCourses, assessments],
  )
  const cumulative = useMemo(() => currentGpa(pastCourses, assessments), [pastCourses, assessments])
  const totalCredits = useMemo(
    () => terms.reduce((sum, t) => sum + t.credits, 0),
    [terms],
  )

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-semibold text-fg">Past semesters</h2>
          <p className="text-[13px] text-subtle">
            {pastCourses.length === 0
              ? 'Your completed terms will live here.'
              : `${terms.length} term${terms.length === 1 ? '' : 's'} · ${totalCredits} credits`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden />
          Add a past course
        </Button>
      </header>

      {pastCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-subtle">
            <GraduationCap size={22} aria-hidden />
          </span>
          <h3 className="mt-3.5 text-[15px] font-semibold text-fg">No past semesters yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-subtle">
            Finished a term? Archive its courses and they&rsquo;ll appear here with your term GPA. Studied
            before you found ConcordiaTracker? Add those courses by hand — just the final grade.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} aria-hidden />
            Add a past course
          </Button>
        </div>
      ) : (
        <>
          {/* Cumulative headline */}
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-surface p-4">
            <div>
              <p className="text-[11.5px] font-medium text-subtle">Cumulative GPA</p>
              <p className="text-[28px] leading-tight font-semibold text-fg tabular-nums">
                {cumulative === null ? '—' : cumulative.toFixed(2)}
                <span className="ml-1 text-[13px] font-normal text-subtle">/ 4.30</span>
              </p>
            </div>
            <div>
              <p className="text-[11.5px] font-medium text-subtle">Credits</p>
              <p className="text-[18px] font-semibold text-fg tabular-nums">{totalCredits}</p>
            </div>
            <p className="ml-auto max-w-[22rem] text-[11.5px] leading-relaxed text-subtle">
              Past grades are frozen when you archive a course, so editing old assessments never
              changes your history.
            </p>
          </div>

          <div className="space-y-5">
            {terms.map((t) => (
              <section key={t.term}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-[14px] font-semibold text-fg">{t.term}</h3>
                  <span className="text-[12px] text-subtle">
                    {t.gpa !== null && (
                      <>
                        GPA <span className="font-semibold text-fg tabular-nums">{t.gpa.toFixed(2)}</span> ·{' '}
                      </>
                    )}
                    {t.credits} credits
                  </span>
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {t.courses.map((c) => {
                    const pct = c.finalPercent
                    const letter = c.finalLetter ?? (typeof pct === 'number' ? percentToGrade(pct).letter : null)
                    const hex = COURSE_COLORS.find((x) => x.id === c.color)?.hex
                    return (
                      <li key={c.id} className="group flex items-center gap-3 px-3.5 py-2.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-fg">{c.code || 'Untitled'}</p>
                          {c.title && <p className="truncate text-[11.5px] text-subtle">{c.title}</p>}
                        </div>
                        <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">{c.credits} cr</span>
                        <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-muted">
                          {typeof pct === 'number' ? `${Math.round(pct)}%` : '—'}
                        </span>
                        <span
                          className={cn(
                            'w-10 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[12px] font-semibold tabular-nums',
                            letter ? 'bg-surface-2 text-fg' : 'text-subtle',
                          )}
                        >
                          {letter ?? '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => unarchiveCourse(c.id)}
                          title="Move back to the current term"
                          aria-label={`Restore ${c.code} to the current term`}
                          className="shrink-0 rounded-md p-1 text-subtle opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Undo2 size={14} aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {adding && <AddPastCourseModal onClose={() => setAdding(false)} />}
    </div>
  )
}
