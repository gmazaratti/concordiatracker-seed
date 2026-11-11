import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Info, Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useAppData } from '@/app/providers/app-data'
import { summarizeRecord } from '@/lib/academic-record'
import { normalizeCode } from '@/lib/prereq'
import {
  listPrograms,
  loadMinorChoice,
  loadProgram,
  loadProgramChoice,
  programPicks,
  saveMinorChoice,
  saveProgramChoice,
  type ProgramPick,
} from '@/lib/programs'
import { computeProgress, type Program, type ProgramWithGroups } from '@/lib/program-progress'
import { cn } from '@/lib/cn'
import { GroupCard } from './program/GroupCard'
import { ProgramHero } from './program/ProgramHero'

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
/** A minor is the same audit over a smaller programme: the component runs
 *  twice on the page, once per `mode`, each with its own saved choice. */
export function ProgramProgress({ mode = 'major' }: { mode?: 'major' | 'minor' } = {}) {
  const minorMode = mode === 'minor'
  const { pastCourses, courses, assessments } = useAppData()
  const [programs, setPrograms] = useState<Program[] | null>(null)
  const [id, setId] = useState('')
  const [program, setProgram] = useState<ProgramWithGroups | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [unsaved, setUnsaved] = useState(false)
  const [picks, setPicks] = useState<ProgramPick[]>([])

  // Loaded beside the programme; failure is silent because a missing crowd
  // signal costs a hint, not the audit.
  useEffect(() => {
    let alive = true
    // Every branch settles through the promise, never synchronously: a
    // setState in the body of an effect is `react-hooks/set-state-in-effect`
    // and cascades a render.
    void (id ? programPicks(id) : Promise.resolve([] as ProgramPick[])).then(
      (p) => alive && setPicks(p),
    )
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    let alive = true
    void listPrograms()
      .then((rows) => alive && setPrograms(rows.filter((p) => (p.degree === 'Minor') === minorMode)))
      .catch(() => alive && setPrograms([]))
    // The choice was never written anywhere: it lived in this component's state
    // and died with the page. That also meant the schedule generator, which
    // reads the saved programme, always saw nothing and told everyone to "pick
    // your programme in My programme first" — which they just had.
    void (minorMode ? loadMinorChoice() : loadProgramChoice()).then((saved) => {
      if (alive && saved) {
        setId(saved)
        setLoading(true)
      }
    })
    return () => {
      alive = false
    }
  }, [minorMode])

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
    if (minorMode && next === '') {
      setId('')
      setProgram(null)
      setLoading(false)
      void saveMinorChoice(null).then((ok) => setUnsaved(!ok))
      return
    }
    setId(next)
    setProgram(null)
    setFailed(false)
    setLoading(true)
    setUnsaved(false)
    // Fire and forget, but the answer is kept: a choice that silently failed to
    // save is one the student re-makes every visit without knowing why.
    void (minorMode ? saveMinorChoice(next) : saveProgramChoice(next)).then((ok) => setUnsaved(!ok))
  }

  /**
   * Grouped by faculty, then by name.
   *
   * Alphabetical across all of them interleaves Aerospace Engineering with
   * Anthropology and Accountancy, which is three faculties in the first three
   * rows. Sorting by faculty first means scrolling lands you among things that
   * are actually near what you want.
   */
  const sortedPrograms = useMemo(
    () =>
      [...(programs ?? [])].sort(
        (a, b) => a.faculty.localeCompare(b.faculty) || a.name.localeCompare(b.name),
      ),
    [programs],
  )

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

  /**
   * The classes on your schedule right now.
   *
   * Passed but not finished is a THIRD state, and it was being drawn as "not
   * done" — so a student halfway through a term looked at a requirement they
   * were sitting in that week and saw a grey empty circle. Green is done, grey
   * is not started, and this is the amber in between.
   */
  const inProgress = useMemo(
    () => new Set(courses.filter((c) => c.code.trim()).map((c) => normalizeCode(c.code))),
    [courses],
  )

  // Already mine — on the record or registered now. Never suggested back.
  const held = useMemo(() => {
    const out = new Set(inProgress)
    for (const c of completed) out.add(normalizeCode(c.code))
    return out
  }, [inProgress, completed])

  const progress = useMemo(
    () => (program ? computeProgress(program, completed) : null),
    [program, completed],
  )

  const picker =
    programs !== null && programs.length > 0 ? (
      <Select
        value={id}
        onChange={choose}
        ariaLabel={minorMode ? 'Minor' : 'Programme'}
        placeholder={minorMode ? 'Pick a minor' : 'Pick your programme'}
        // Fifty-odd entries is past the point where scrolling is the right
        // interaction. Someone who knows they are in Finance should type four letters.
        searchable
        options={[
          ...(minorMode && id ? [{ value: '', label: 'No minor' }] : []),
          ...sortedPrograms.map((p) => ({
            value: p.id,
            label: minorMode ? p.name : `${p.name} (${p.degree})`,
          })),
        ]}
      />
    ) : null

  /** Required courses that are on this term's schedule and not yet passed. */
  const takingNow = progress
    ? progress.groups.reduce(
        (n, g) => n + (g.counted ? g.remaining.filter((c) => inProgress.has(normalizeCode(c.code))).length : 0),
        0,
      )
    : 0

  return (
    <div className="space-y-5">
      {minorMode ? (
        // The minor is the same audit, quieter: one banner per page is enough.
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-8">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-semibold tracking-tight text-fg">
              {program ? program.name : 'Your minor'}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {program && progress
                ? `${progress.earnedNamed} of ${progress.requiredNamed} credits in the required courses`
                : 'Optional. Track a minor the same way as your major.'}
            </p>
          </div>
          {picker && <div className="w-full sm:w-80">{picker}</div>}
        </div>
      ) : (
        <ProgramHero program={loading ? null : program} progress={loading ? null : progress} inProgress={takingNow} picker={picker} />
      )}

      {programs !== null && programs.length === 0 && (
        <p className="rounded-3xl border border-dashed border-border-strong px-5 py-10 text-center text-[14px] text-muted">
          No programmes have been added yet. Requirements are transcribed from the calendar by hand, a programme at a
          time.
        </p>
      )}

      {minorMode && !id && programs !== null && programs.length > 0 && (
        <p className="rounded-3xl border border-dashed border-border-strong px-5 py-8 text-center text-[14px] text-muted">
          Doing a minor? Pick it and this shows what you have cleared and what is left.
        </p>
      )}

      {unsaved && (
        <p className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] leading-relaxed text-fg">
          Showing this for now, but we could not save the choice. It will be gone when you reload, and the schedule
          generator will not see it.
        </p>
      )}

      {loading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
        </div>
      )}

      {failed && (
        <p className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[13px] text-muted">
          Could not load the requirements. Try again in a moment.
        </p>
      )}

      {program && progress && !loading && (
        <>
          {/* A programme we know the shape of but not the contents. Saying so
              is the whole point: the alternative is an empty page that reads
              as broken, or a plausible list of requirements nobody transcribed. */}
          {program.groups.length === 0 && (
            <section className="rounded-3xl border border-dashed border-border-strong bg-surface/50 p-5 sm:p-6">
              <p className="flex items-start gap-2.5 font-display text-[18px] font-semibold text-fg">
                <Info size={18} className="mt-1 shrink-0 text-accent" aria-hidden />
                Requirements for {program.name} are not transcribed yet
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                We have the degree and its {program.total_credits} credits, but not its course lists. Those are copied
                from the calendar by hand, one programme at a time, because a degree audit that guesses is worse than
                no degree audit: people plan a year around it. Yours is on the list.
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-subtle">
                In the meantime this choice is saved, so the schedule builder and the course recommendations know what
                you are in. Your <span className="text-fg">{progress.totalCompletedCredits} credits passed</span> are
                counted.
              </p>
            </section>
          )}

          {/* Three colours carrying three meanings, explained once. */}
          {program.groups.length > 0 && <Legend />}

          {progress.groups.map(({ group, done, remaining, earnedCredits, counted }, i) => (
            <GroupCard
              key={group.id}
              group={group}
              done={done}
              remaining={remaining}
              earnedCredits={earnedCredits}
              counted={counted}
              inProgress={inProgress}
              picks={picks}
              held={held}
              delay={Math.min(i, 6) * 50}
            />
          ))}

          {/* ── Provenance ───────────────────────────────────────────── */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-subtle">
            <span>
              Transcribed from the {program.calendar_year} undergraduate calendar. Always confirm with an advisor before
              you register or apply to graduate.
            </span>
            <a
              href={program.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-medium text-accent transition-colors duration-150 hover:underline"
            >
              Check the calendar
              <ExternalLink size={12} aria-hidden />
            </a>
          </p>
        </>
      )}
    </div>
  )
}

/** What the three states mean, said once at the top rather than per pill. */
function Legend() {
  const items: { cls: string; dot: string; label: string; hint: string }[] = [
    {
      cls: 'border-success/40 bg-success/10',
      dot: 'border-success bg-success',
      label: 'Passed',
      hint: 'on your record',
    },
    {
      cls: 'border-warning/40 bg-warning/10',
      dot: 'border-warning bg-warning',
      label: 'In progress',
      hint: 'on your schedule now',
    },
    {
      cls: 'border-border bg-canvas',
      dot: 'border-border-strong',
      label: 'Not taken',
      hint: 'still outstanding',
    },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-surface/60 px-4 py-3">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2 text-[13px]">
          <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-full border-2', i.dot)} aria-hidden />
          <span className="font-semibold text-fg">{i.label}</span>
          <span className="text-muted">{i.hint}</span>
        </span>
      ))}
      <span className="text-[12.5px] text-subtle lg:ml-auto">
        A group with no tick boxes is a rule we will not guess at, so see its wording.
      </span>
    </div>
  )
}
