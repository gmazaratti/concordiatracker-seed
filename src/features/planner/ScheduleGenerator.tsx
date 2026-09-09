import { useState } from 'react'
import { CalendarRange, Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { findSections, termLabel, type SectionOption } from '@/lib/seats'
import { parseCourseCode } from '@/lib/course-sections'
import { browseCourses } from '@/lib/catalog'
import { outstandingRequired } from '@/lib/recommend'
import { checkPrereq, normalizeCode, type Record as PrereqRecord } from '@/lib/prereq'
import type { ProgramWithGroups } from '@/lib/program-progress'
import {
  generateSchedules,
  toCombos,
  PREFERENCES,
  type Campus,
  type CourseOption,
  type GeneratedSchedule,
  type Preference,
} from '@/lib/schedule-generate'
import { cn } from '@/lib/cn'
import type { Block } from './schedule'

/**
 * "Build me one."
 *
 * The generator picks TIMES for courses, which is a scheduling problem with a
 * right answer. It does not decide what belongs in a degree — that is a
 * different question, and one this app answers far more carefully elsewhere.
 * The candidate list therefore comes from requirements the student has not
 * finished, or from courses they typed themselves, and never from a guess about
 * what they "should" want.
 *
 * Everything it produces is a DRAFT. Nothing reaches the week until Use this
 * one is pressed, and nothing reaches Concordia at all — the footer under the
 * grid has said so since the builder shipped and still does.
 */

/** Full-time at Concordia starts at 12 credits; 15 is the standard four-course
 *  term. */
const LOADS = [
  { value: '9', label: '9 credits · part-time' },
  { value: '12', label: '12 credits · full-time minimum' },
  { value: '15', label: '15 credits · standard' },
  { value: '18', label: '18 credits · heavy' },
]

/** The Extended Credit Programme carries a 15-credit floor, not the ordinary
 *  12 — so the loads below it are not offered while it is ticked rather than
 *  quietly generating a term that does not meet the requirement. */
const ECP_MINIMUM = 15

const CAMPUSES: { value: Campus; label: string; hint: string }[] = [
  { value: 'sgw', label: 'SGW', hint: 'Sir George Williams — downtown' },
  { value: 'loyola', label: 'Loyola', hint: 'Loyola — NDG' },
  { value: 'online', label: 'Online', hint: 'No campus at all' },
]

export function ScheduleGenerator({
  program,
  termCode,
  blocks,
  taken,
  pinned,
  eligibleOnly,
  record,
  existing,
  onResults,
}: {
  program: ProgramWithGroups | null
  termCode: string
  blocks: Block[]
  /** Passed and currently registered — never generated back at you. */
  taken: string[]
  /** The Filters toggle: drop anything whose prerequisites you have not met. */
  eligibleOnly: boolean
  record: PrereqRecord
  /** Kept exactly as they are in every draft. */
  pinned: { code: string; sections: SectionOption[] }[]
  /**
   * Everything currently on the week, for "build on what I have".
   *
   * Carries its own credit value, because these courses are not in the
   * candidate pool and a kept 3.5-credit lecture counted as 3 would quietly
   * miss the load the student asked for.
   */
  existing: { code: string; sections: SectionOption[]; credits: number }[]
  /**
   * Hand the drafts to the page.
   *
   * Cycling used to happen inside this dialog, against a list of course codes
   * and times — which is the one place you cannot see what a timetable actually
   * looks like. The whole question is "what does my week become", so the drafts
   * go onto the real week grid and the arrows sit above it. `again` re-runs with
   * a fresh seed, so More keeps working from out there without lifting this
   * component's form state anywhere.
   */
  onResults: (results: GeneratedSchedule[], again: () => void) => void
}) {
  const [target, setTarget] = useState('15')
  const [ecp, setEcp] = useState(false)
  const [wanted, setWanted] = useState('')
  const [prefer, setPrefer] = useState<Preference>('days-off')
  // Empty means "anywhere". Stated as a list rather than three booleans so it
  // maps straight onto the generator's own input.
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [mode, setMode] = useState<'fresh' | 'keep'>('fresh')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [seed, setSeed] = useState(1)
  const loads = ecp ? LOADS.filter((l) => Number(l.value) >= ECP_MINIMUM) : LOADS
  const keepable = existing.filter((e) => !pinned.some((p) => p.code === e.code))

  async function generate(nextSeed = seed) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const requestedCodes = wanted
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)

      // Candidates: what you asked for by name, then what your programme still
      // requires. Never anything else — a generator that invents courses is
      // giving academic advice it has no basis for.
      const outstanding = outstandingRequired(program, taken).map((c) => c.code)
      const done = new Set(taken.map(normalizeCode))
      const codes = [
        ...new Set([...requestedCodes, ...outstanding].map((c) => c.trim().toUpperCase())),
      ]
        .filter((c) => parseCourseCode(c) && !done.has(normalizeCode(c)))
        // Ten courses is already twice a full load; fetching thirty sections
        // lists to schedule five of them is a worse trade than a narrower pool.
        .slice(0, 10)

      if (codes.length === 0) {
        setError(
          program
            ? 'Nothing outstanding to schedule. Add a course above, or name one below.'
            : 'Pick your programme in My programme first, or name the courses you want below.',
        )
        return
      }

      // Titles and credit values from the calendar mirror, so a generated
      // schedule reports the university's own credit count rather than an
      // assumed 3 — the number the whole full-time check depends on.
      const meta = new Map<string, { title: string; credits: number }>()
      const subjects = [...new Set(codes.map((c) => parseCourseCode(c)!.subject))]
      const { rows } = await browseCourses({ subjects, limit: 600 })
      for (const r of rows) {
        meta.set(normalizeCode(`${r.subject} ${r.catalog}`), {
          title: r.title,
          credits: r.class_unit ?? 3,
        })
      }

      const requestedSet = new Set(requestedCodes.map(normalizeCode))
      const candidates: CourseOption[] = []
      const skippedForPrereq: string[] = []
      for (const code of codes) {
        const parsed = parseCourseCode(code)!

        // The same check the search runs, using the same parser — so "only
        // what I can take" means one thing everywhere. It reads Concordia's
        // prose and refuses to guess at anything it cannot parse cleanly, so a
        // course only drops out when the answer is genuinely "not yet".
        if (eligibleOnly) {
          const prose = rows.find(
            (r) => normalizeCode(`${r.subject} ${r.catalog}`) === normalizeCode(code),
          )?.description
          const verdict = prose ? checkPrereq(prose, record).verdict : 'met'
          // Only a definite NO drops a course. "unknown" — a sentence the
          // parser could not read — leaves it in, because refusing to schedule
          // something on the strength of a rule we could not understand is the
          // wrong way round: it is the same discipline the search uses.
          const definitelyNo = verdict === 'not-met' || verdict === 'blocked'
          if (definitelyNo && !requestedSet.has(normalizeCode(code))) {
            skippedForPrereq.push(code)
            continue
          }
        }
        const sections = await findSections(parsed.subject, parsed.catalog).catch(
          () => [] as SectionOption[],
        )
        const inTerm = sections.filter((s) => s.termCode === termCode && s.meetingTimes)
        const info = meta.get(normalizeCode(code))
        candidates.push({
          code,
          title: info?.title ?? code,
          credits: info?.credits ?? 3,
          combos: toCombos(inTerm),
          requested: requestedSet.has(normalizeCode(code)),
        })
      }

      // "Keep what I have" is expressed as pinning, not as a second code path:
      // the classes already on the week become fixed, the generator fills the
      // rest of the load around them, and everything downstream — conflicts,
      // warnings, ranking — behaves exactly as it always did.
      const held =
        mode === 'keep'
          ? [...pinned, ...keepable.filter((e) => e.sections.some((s) => s.meetingTimes))]
          : pinned

      const generated = generateSchedules({
        candidates,
        pinned: held,
        blocks,
        targetCredits: Number(target),
        count: 6,
        seed: nextSeed,
        prefer,
        campuses,
      })

      if (generated.length > 0) {
        const next = nextSeed + 100
        onResults(generated, () => {
          setSeed(next)
          void generate(next)
        })
      }
      if (skippedForPrereq.length > 0) {
        setError(
          `Left out for now: ${skippedForPrereq.join(', ')} — prerequisites not met yet. Turn off "only what I can take" in Filters to include them anyway.`,
        )
      }
      if (generated.length === 0) {
        setError(
          campuses.length > 0
            ? 'Nothing fits around what you have pinned, blocked out, and the campuses you ticked. Try adding a campus or freeing some time.'
            : 'Nothing fits around what you have pinned and blocked out. Try freeing some time.',
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach Concordia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {/* Start over, or work around what is already there. The second is the
            more common real task — one class is settled and the rest of the
            term has to fit around it — and it was not possible before. */}
        {keepable.length > 0 && (
          <div className="flex gap-1 rounded-lg border border-border bg-canvas p-1">
            {(
              [
                ['fresh', 'Start fresh', 'Replaces everything on the week'],
                ['keep', 'Build on mine', `Keeps the ${keepable.length} you have and fills around them`],
              ] as const
            ).map(([v, label, hint]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                aria-pressed={mode === v}
                title={hint}
                className={cn(
                  'flex-1 rounded px-2 py-1.5 text-[12px] font-medium transition-colors duration-150',
                  mode === v
                    ? 'bg-accent text-accent-contrast'
                    : 'text-muted hover:text-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-[11.5px] text-subtle">How much do you want to take?</span>
          <Select value={target} onChange={setTarget} ariaLabel="Credit load" options={loads} size="sm" />
        </label>

        <Checkbox
          checked={ecp}
          onChange={(next) => {
            setEcp(next)
            // ECP carries a 15-credit floor. Ticking it while a lighter load is
            // selected has to move the load, not just hide the option — leaving
            // 12 selected under a 15-credit rule is the wrong number arrived at
            // silently, which is the failure this whole app is built against.
            if (next && Number(target) < ECP_MINIMUM) setTarget(String(ECP_MINIMUM))
          }}
          label={<>I&rsquo;m in the Extended Credit Programme</>}
          hint="15 credits a term is the minimum, so lighter loads are not offered."
        />

        {/* The shape of the week, not the amount of it. Credits still decide
            first — this only breaks ties between equally-full timetables. */}
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-subtle">What kind of week?</span>
          <Select
            value={prefer}
            onChange={(v) => setPrefer(v as Preference)}
            ariaLabel="Preferred shape of week"
            options={PREFERENCES.map((p) => ({ value: p.value, label: p.label }))}
            size="sm"
          />
        </label>

        <div>
          <span className="mb-1 block text-[11.5px] text-subtle">
            Where will you go? <span className="text-subtle">(any, if none ticked)</span>
          </span>
          <div className="flex gap-1.5">
            {CAMPUSES.map((c) => {
              const on = campuses.includes(c.value)
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() =>
                    setCampuses((prev) =>
                      prev.includes(c.value)
                        ? prev.filter((x) => x !== c.value)
                        : [...prev, c.value],
                    )
                  }
                  aria-pressed={on}
                  title={c.hint}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-1.5 text-[12px] transition-colors duration-150',
                    on
                      ? 'border-accent bg-accent-soft font-medium text-accent'
                      : 'border-border text-muted hover:border-accent hover:text-fg',
                  )}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          {campuses.length > 0 && (
            <span className="mt-1 block text-[11px] leading-relaxed text-subtle">
              Sections whose campus Concordia did not publish are still included — a gap in our
              reading should not delete an option that exists.
            </span>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-[11.5px] text-subtle">
            Any specific classes? <span className="text-subtle">(optional)</span>
          </span>
          <input
            value={wanted}
            onChange={(e) => setWanted(e.target.value)}
            placeholder="COMM 308, FINA 385"
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <span className="mt-1 block text-[11px] leading-relaxed text-subtle">
            These go in first, every time. Leave it empty and it fills from what your programme
            still needs.
          </span>
        </label>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || !termCode}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <CalendarRange size={15} aria-hidden />
          )}
          {busy ? 'Working it out…' : 'Generate a schedule'}
        </button>
        {!termCode && (
          <p className="text-[11.5px] text-subtle">Search for a course first so we know the term.</p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-muted">
          {error}
        </p>
      )}

      {termCode && (
        <p className="text-[11px] leading-relaxed text-subtle">
          Drafts only, for {termLabel(termCode)}. Nothing is registered anywhere.
        </p>
      )}
    </div>
  )
}
