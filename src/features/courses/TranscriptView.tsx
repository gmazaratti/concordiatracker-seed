import { useMemo, useState } from 'react'
import { useShownGpa } from '@/app/hooks/useShownGpa'
import { GraduationCap, Plus, Undo2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { currentGpa, percentToGrade, termRecords } from '@/lib/gpa'
import { sortTermsDesc } from '@/lib/term'
import { COURSE_COLORS } from '@/lib/course-color'
import { Button } from '@/components/ui/Button'
import { AddPastCourseModal } from './AddPastCourseModal'
import { MoveConfirm } from './MoveConfirm'
import { currentTermName } from '@/features/planner/past-terms'
import { cn } from '@/lib/cn'

/** Past semesters — a transcript: each finished term with its courses, letter
 * grades and term GPA, plus the cumulative GPA across everything graded. */
export function TranscriptView() {
  const { pastCourses, courses, assessments, moveToCurrentTerm } = useAppData()
  const [adding, setAdding] = useState(false)
  /** The row asking "move this to the current term?" (one at a time). */
  const [confirming, setConfirming] = useState<string | null>(null)
  const nowTerm = currentTermName()
  const key = (code: string) => code.replace(/[\s-]+/g, '').toUpperCase()
  // The same course is already live this term: moving would make a duplicate
  // (and the database refuses it), so the row says so instead of offering it.
  const liveThisTerm = useMemo(
    () => new Set(courses.filter((c) => c.term === nowTerm && c.code).map((c) => key(c.code))),
    [courses, nowTerm],
  )

  const terms = useMemo(
    () => termRecords(pastCourses, assessments, sortTermsDesc),
    [pastCourses, assessments],
  )
  const shown = useShownGpa()
  const cumulative = shown(useMemo(() => currentGpa(pastCourses, assessments), [pastCourses, assessments]))
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
            before you found ConcordiaTracker? Add those courses by hand: just the final grade.
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
                      <li key={c.id} className="group px-3.5 py-2.5">
                        <div className="flex items-center gap-3">
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
                          onClick={() => setConfirming(confirming === c.id ? null : c.id)}
                          title={`Move to ${nowTerm}`}
                          aria-label={`Move ${c.code || 'this course'} to ${nowTerm}`}
                          aria-expanded={confirming === c.id}
                          // Visible on touch screens (no hover to reveal it);
                          // hover-revealed only where a pointer can hover.
                          className="shrink-0 rounded-md p-1 text-subtle transition-opacity hover:text-fg focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                        >
                          <Undo2 size={14} aria-hidden />
                        </button>
                        </div>
                        {confirming === c.id && (
                          <MoveConfirm
                            code={c.code || 'This course'}
                            term={nowTerm}
                            duplicate={!!c.code && liveThisTerm.has(key(c.code))}
                            // A hand-entered grade has no assessments to rebuild it from.
                            losesTypedGrade={!!letter && !assessments.some((a) => a.courseId === c.id)}
                            onMove={() => {
                              moveToCurrentTerm(c.id)
                              setConfirming(null)
                            }}
                            onCancel={() => setConfirming(null)}
                          />
                        )}
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
