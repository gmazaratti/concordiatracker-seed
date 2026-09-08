import type { SectionOption } from './seats'
import {
  clashesWithBlocks,
  findCampusGaps,
  findConflicts,
  placeSections,
  type Block,
} from '@/features/planner/schedule'

/**
 * Building a timetable out of the sections Concordia published.
 *
 * PURE — no React, no network — so the search can be checked in Node. The whole
 * value of this feature is that the answer is correct, and a conflict-free
 * timetable is not something you verify by looking at it.
 *
 * WHAT IT IS NOT: a registration, and not advice about what to take. It picks
 * TIMES for courses the student has already agreed to consider, which is a
 * scheduling problem with a right answer. Which courses belong in a degree is a
 * different question, and `lib/recommend.ts` answers that one separately and
 * far more carefully.
 */

/** One complete registration for a course: a lecture, plus whatever tutorial or
 *  lab has to come with it. */
export type Combo = SectionOption[]

export interface CourseOption {
  code: string
  title: string
  credits: number
  /** Every way of taking this course. Empty means it cannot be scheduled. */
  combos: Combo[]
  /** The student asked for this one by name — try it before anything else. */
  requested?: boolean
}

export interface GenerateInput {
  candidates: CourseOption[]
  /** Kept exactly as given, in every result. */
  pinned: { code: string; sections: SectionOption[] }[]
  blocks: Block[]
  /** Credits to reach. 15 is a normal full-time load; ECP students take fewer. */
  targetCredits: number
  /** How many distinct timetables to return. */
  count?: number
  seed?: number
}

export interface GeneratedPick {
  code: string
  title: string
  credits: number
  sections: SectionOption[]
  pinned: boolean
}

export type WarningKind = 'under-target' | 'unplaceable' | 'campus-gap' | 'over-target'

export interface GenWarning {
  kind: WarningKind
  text: string
}

export interface GeneratedSchedule {
  /** Stable across regenerations: the same set of sections is the same result. */
  id: string
  picks: GeneratedPick[]
  credits: number
  /** Weekdays with nothing on them, 1 = Monday. */
  daysOff: number[]
  warnings: GenWarning[]
}

/**
 * Deterministic RNG (mulberry32).
 *
 * Seeded rather than Math.random so that "give me another one" is reproducible
 * and testable: the same seed always yields the same timetable, and cycling is
 * just seed + 1. A generator you cannot re-run is a generator you cannot debug.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(list: T[], rand: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Does adding these sections collide with what is already down, or with a
 *  time the student blocked out? */
function fits(
  placedSoFar: { code: string; section: SectionOption }[],
  combo: Combo,
  code: string,
  blocks: Block[],
): boolean {
  for (const s of combo) {
    if (clashesWithBlocks(s.meetingTimes, blocks).length > 0) return false
  }
  const next = [...placedSoFar, ...combo.map((section) => ({ code, section }))]
  return findConflicts(placeSections(next)).length === 0
}

const signature = (picks: GeneratedPick[]): string =>
  picks
    .flatMap((p) => p.sections.map((s) => s.classNumber))
    .sort()
    .join(',')

/**
 * One timetable, by depth-first search over the shuffled candidates.
 *
 * Greedy with backtracking rather than exhaustive: it takes the first course
 * order and section choice that fits and only reconsiders when it gets stuck.
 * Exhaustive search over ~8 courses × ~10 sections is combinatorially large and
 * buys nothing here, because there is no single "best" timetable to find — the
 * student is going to cycle and pick the one they like. Randomising the order
 * per seed is what makes cycling produce genuinely different answers rather
 * than the same greedy result every time.
 */
function buildOne(
  input: GenerateInput,
  seed: number,
): { picks: GeneratedPick[]; credits: number; unplaceable: string[] } {
  const rand = rng(seed)
  const chosen: { code: string; section: SectionOption }[] = []
  const picks: GeneratedPick[] = []
  let credits = 0

  for (const p of input.pinned) {
    for (const section of p.sections) chosen.push({ code: p.code, section })
    const meta = input.candidates.find((c) => c.code === p.code)
    picks.push({
      code: p.code,
      title: meta?.title ?? p.code,
      credits: meta?.credits ?? 3,
      sections: p.sections,
      pinned: true,
    })
    credits += meta?.credits ?? 3
  }

  const pinnedCodes = new Set(input.pinned.map((p) => p.code))
  const pool = input.candidates.filter((c) => !pinnedCodes.has(c.code))

  // Requested courses first, always. A student who typed "I need ACCO 310" is
  // stating a constraint, not a preference, and a generator that drops it
  // because a random ordering got there late has not answered the question.
  const requested = shuffled(
    pool.filter((c) => c.requested),
    rand,
  )
  const rest = shuffled(
    pool.filter((c) => !c.requested),
    rand,
  )
  const order = [...requested, ...rest]

  const unplaceable: string[] = []

  for (const course of order) {
    if (credits >= input.targetCredits && !course.requested) break
    if (course.combos.length === 0) {
      unplaceable.push(course.code)
      continue
    }
    const combo = shuffled(course.combos, rand).find((c) =>
      fits(chosen, c, course.code, input.blocks),
    )
    if (!combo) {
      // Only a problem worth reporting if it was asked for by name; otherwise
      // it is simply a course that did not fit this particular draft.
      if (course.requested) unplaceable.push(course.code)
      continue
    }
    for (const section of combo) chosen.push({ code: course.code, section })
    picks.push({
      code: course.code,
      title: course.title,
      credits: course.credits,
      sections: combo,
      pinned: false,
    })
    credits += course.credits
  }

  return { picks, credits, unplaceable }
}

function warningsFor(
  picks: GeneratedPick[],
  credits: number,
  target: number,
  unplaceable: string[],
): GenWarning[] {
  const out: GenWarning[] = []

  if (unplaceable.length > 0) {
    out.push({
      kind: 'unplaceable',
      text: `${unplaceable.join(', ')} could not be fitted — every section clashes with something you kept or a time you blocked.`,
    })
  }
  if (credits < target) {
    out.push({
      kind: 'under-target',
      // Named as a fact, not a failure: sometimes there genuinely is no
      // conflict-free way to reach the target from what is on offer.
      text: `${credits} of ${target} credits. Nothing else on offer fits around what is already here.`,
    })
  }
  if (credits > target) {
    out.push({
      kind: 'over-target',
      text: `${credits} credits — ${credits - target} over what you asked for.`,
    })
  }

  const placed = placeSections(
    picks.flatMap((p) => p.sections.map((section) => ({ code: p.code, section }))),
  )
  for (const gap of findCampusGaps(placed)) {
    out.push({
      kind: 'campus-gap',
      text: `${gap.from.code} to ${gap.to.code} is a campus change with ${gap.minutes} minutes between them — the shuttle takes about 30.`,
    })
  }

  return out
}

/**
 * Several distinct timetables, best-filled first.
 *
 * Distinct means a different SET OF SECTIONS, not merely a different order —
 * cycling through three drafts that are the same classes is the fastest way to
 * make a generator feel broken. It tries well beyond `count` seeds because many
 * seeds collapse to the same answer once the constraints are tight, which is
 * itself the honest outcome: a heavily-blocked week may only have one solution.
 */
export function generateSchedules(input: GenerateInput): GeneratedSchedule[] {
  const count = input.count ?? 5
  const baseSeed = input.seed ?? 1
  const seen = new Set<string>()
  const out: GeneratedSchedule[] = []

  for (let i = 0; i < count * 12 && out.length < count; i++) {
    const { picks, credits, unplaceable } = buildOne(input, baseSeed + i)
    if (picks.length === 0) continue
    const sig = signature(picks)
    if (seen.has(sig)) continue
    seen.add(sig)

    const placed = placeSections(
      picks.flatMap((p) => p.sections.map((section) => ({ code: p.code, section }))),
    )
    const busy = new Set(placed.map((p) => p.slot.day))

    out.push({
      id: sig,
      picks,
      credits,
      daysOff: [1, 2, 3, 4, 5].filter((d) => !busy.has(d)),
      warnings: warningsFor(picks, credits, input.targetCredits, unplaceable),
    })
  }

  // Closest to the requested load first, then the one with the most days off —
  // which is the preference every student expresses when asked.
  return out.sort((a, b) => {
    const da = Math.abs(a.credits - input.targetCredits)
    const db = Math.abs(b.credits - input.targetCredits)
    if (da !== db) return da - db
    return b.daysOff.length - a.daysOff.length
  })
}

/**
 * Group a term's raw sections into per-course registration options.
 *
 * Concordia publishes a row per section per component, so a course with 3
 * lectures and 4 tutorials is 7 rows that actually represent 12 ways of taking
 * it. Pairing every lecture with every tutorial is what turns those rows into
 * something a scheduler can choose between.
 *
 * Capped, because 3 lectures × 4 tutorials × 4 labs is 48 combinations for one
 * course and the search does not get better answers from exploring all of them.
 */
export function toCombos(sections: SectionOption[], limit = 24): Combo[] {
  const byComponent = new Map<string, SectionOption[]>()
  for (const s of sections) {
    const key = s.component || 'LEC'
    if (!byComponent.has(key)) byComponent.set(key, [])
    byComponent.get(key)!.push(s)
  }
  // Lecture first so a combo always leads with the thing people call "the class".
  const groups = [...byComponent.entries()]
    .sort((a, b) => (a[0] === 'LEC' ? -1 : b[0] === 'LEC' ? 1 : a[0].localeCompare(b[0])))
    .map(([, list]) => list)

  let combos: Combo[] = [[]]
  for (const group of groups) {
    const next: Combo[] = []
    for (const partial of combos) {
      for (const option of group) {
        next.push([...partial, option])
        if (next.length >= limit) break
      }
      if (next.length >= limit) break
    }
    combos = next
  }
  // A combination whose own components clash is not a way of taking the course.
  return combos.filter(
    (c) => findConflicts(placeSections(c.map((section) => ({ code: 'x', section })))).length === 0,
  )
}
