import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Info, Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useAppData } from '@/app/providers/app-data'
import { summarizeRecord } from '@/lib/academic-record'
import { listPrograms, loadProgram } from '@/lib/programs'
import { computeProgress, type Program, type ProgramWithGroups } from '@/lib/program-progress'
import { cn } from '@/lib/cn'

/**
 * Where you are in your degree.
 *
 * The honest version of a degree audit. Named requirements — the cores — are
 * ticked off exactly against your record. Elective requirements are shown with
 * the calendar's own wording and counted at zero, because their rules are prose
 * with exclusions and a confident wrong answer here is the most expensive
 * mistake this product could make. The gap between the two is filled by a
 * number that IS a fact: credits you have passed that no named requirement has
 * claimed.
 *
 * Every programme carries the calendar year it was transcribed from and a link
 * to the page it came from, so a student can check us, and so it is obvious
 * when it has gone stale.
 */
export function ProgramProgress() {
  const { pastCourses, courses, assessments } = useAppData()
  const [programs, setPrograms] = useState<Program[] | null>(null)
  const [id, setId] = useState('')
  const [program, setProgram] = useState<ProgramWithGroups | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void listPrograms()
      .then((rows) => alive && setPrograms(rows))
      .catch(() => alive && setPrograms([]))
    return () => {
      alive = false
    }
  }, [])

  // Loading is flipped on where the choice is made, not here: a setState in an
  // effect body runs during render and React (rightly) objects.
  useEffect(() => {
    if (!id) return
    let alive = true
    void loadProgram(id)
      .then((p) => alive && setProgram(p))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  function choose(next: string) {
    setId(next)
    setProgram(null)
    setFailed(false)
    setLoading(true)
  }

  /** Everything passed, with the credits the student's own record carries. */
  const completed = useMemo(() => {
    const summary = summarizeRecord(pastCourses, assessments)
    const seen = new Map<string, number>()
    for (const code of summary.completedCodes) {
      const row = [...pastCourses, ...courses].find((c) => c.code.trim() === code)
      seen.set(code, row?.credits ?? 3)
    }
    return [...seen].map(([code, credits]) => ({ code, credits }))
  }, [pastCourses, courses, assessments])

  const progress = useMemo(
    () => (program ? computeProgress(program, completed) : null),
    [program, completed],
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-fg">Your programme</h2>
          <p className="mt-0.5 text-[12.5px] text-subtle">
            What the calendar asks for, against what you have done.
          </p>
        </div>
        {programs !== null && programs.length > 0 && (
          <Select
            value={id}
            onChange={choose}
            ariaLabel="Programme"
            placeholder="Pick your programme"
            options={programs.map((p) => ({ value: p.id, label: `${p.name} (${p.degree})` }))}
          />
        )}
      </div>

      {programs !== null && programs.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-border px-5 py-10 text-center text-[13px] text-subtle">
          No programmes have been added yet. Requirements are transcribed from the calendar by
          hand, a programme at a time.
        </p>
      )}

      {!id && programs !== null && programs.length > 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-border px-5 py-10 text-center text-[13px] text-subtle">
          Pick your programme and this will show what you have cleared and what is left.
        </p>
      )}

      {loading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
        </div>
      )}

      {failed && (
        <p className="mt-4 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-subtle">
          Could not load the requirements. If this build is new, db/program_requirements.sql may
          not have been run yet.
        </p>
      )}

      {program && progress && !loading && (
        <div className="mt-4 space-y-4">
          {/* ── Headline ─────────────────────────────────────────────── */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[13px] font-semibold text-fg">
                {program.name}{' '}
                <span className="font-normal text-subtle">· {program.degree}</span>
              </p>
              <p className="text-[12px] text-subtle">
                {program.total_credits} credits · {program.faculty}
              </p>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-[24px] leading-none font-semibold text-fg">
                {progress.earnedNamed}
              </span>
              <span className="text-[13px] text-muted">
                of {progress.requiredNamed} credits in the required courses
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${progress.percentNamed}%` }}
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Stat label="Credits passed, all told" value={progress.totalCompletedCredits} />
              <Stat
                label="Not claimed by a required course"
                value={progress.unassignedCredits}
                hint="These probably go toward your electives. Which ones count is a rule we do not try to read, so they are not added in above."
              />
            </div>
          </section>

          {/* ── Groups ───────────────────────────────────────────────── */}
          {progress.groups.map(({ group, done, remaining, earnedCredits, counted }) => (
            <section key={group.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-[13px] font-semibold text-fg">{group.title}</h3>
                <p className="text-[12px] text-subtle">
                  {counted ? (
                    <>
                      {earnedCredits} of {group.credits} credits
                    </>
                  ) : (
                    <>{group.credits} credits</>
                  )}
                </p>
              </div>

              {counted ? (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.round((earnedCredits / group.credits) * 100)}%` }}
                    />
                  </div>
                  <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {[...done, ...remaining].map((course) => {
                      const isDone = done.includes(course)
                      return (
                        <li
                          key={course.code}
                          className={cn(
                            'flex items-start gap-2 rounded-lg border px-2.5 py-1.5',
                            isDone
                              ? 'border-success/40 bg-success/10'
                              : 'border-border bg-canvas',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                              isDone ? 'border-success bg-success' : 'border-border-strong',
                            )}
                            aria-hidden
                          >
                            {isDone && <Check size={10} className="text-canvas" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-medium text-fg">
                              {course.code}
                              <span className="ml-1.5 font-normal text-subtle">
                                {course.credits}
                              </span>
                            </span>
                            <span className="block text-[11.5px] leading-snug text-subtle">
                              {course.title}
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <div className="mt-2 rounded-lg border border-border bg-canvas px-3 py-2.5">
                  <p className="text-[12.5px] leading-relaxed text-muted">{group.rule}</p>
                  <p className="mt-1.5 text-[11.5px] text-subtle">
                    Not ticked off automatically — which courses satisfy this depends on wording we
                    will not guess at.
                  </p>
                </div>
              )}

              {group.note && (
                <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-subtle">
                  <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {group.note}
                </p>
              )}
            </section>
          ))}

          {/* ── Provenance ───────────────────────────────────────────── */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-subtle">
            <span>
              Transcribed from the {program.calendar_year} undergraduate calendar. Always confirm
              with an advisor before you register or apply to graduate.
            </span>
            <a
              href={program.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-accent transition-colors duration-150 hover:underline"
            >
              Check the calendar
              <ExternalLink size={11} aria-hidden />
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-canvas px-3 py-2" title={hint}>
      <p className="text-[16px] font-semibold text-fg tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-subtle">{label}</p>
    </div>
  )
}
