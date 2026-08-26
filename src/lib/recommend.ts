import { normalizeCode } from './prereq'
import { matchesPattern, type ProgramWithGroups, type RequirementCourse } from './program-progress'

/**
 * "If you can't find a course you'd like, here's what you still need."
 *
 * THE FRAMING IS THE FEATURE. This is not an advisor and it must never read
 * like one. It answers a question the student asked — "what's left?" — with
 * facts they could verify themselves in the calendar, and it says nothing about
 * what they *should* do. A wrong recommendation here costs a semester and a
 * tuition instalment, so the design principle is the same one the provenance
 * badges follow: state what we know, mark what we inferred, stay silent on what
 * we don't.
 *
 * Three tiers, and they are ordered by how certain we are, not by how useful
 * they sound:
 *
 *   required   Named in a requirement group you have not finished. This is a
 *              FACT — the calendar says so and we are quoting it.
 *   elective   Matches a mechanical elective rule ("400-level FINA"). Also a
 *              fact, but a weaker one: it counts toward a bucket rather than
 *              being a course you specifically must take.
 *   unlocks    Its prerequisite text mentions something you have passed. This
 *              is a HEURISTIC and is labelled as one everywhere it appears —
 *              we extract course codes from prose, we do not parse the logic
 *              between them, so "you can take this" is not a claim we make.
 *
 * Pure: no Supabase import, no React. The callers fetch; this decides.
 */

export interface CatalogEntry {
  subject: string
  catalog: string
  title: string
  credits: number
  /** Concordia's prerequisite prose, verbatim. Never parsed for logic. */
  prerequisites?: string | null
}

export type SuggestionReason = 'required' | 'elective' | 'unlocks'

export interface Suggestion {
  code: string
  title: string
  credits: number
  reason: SuggestionReason
  /** One line, in the student's language, saying WHY this is here. */
  because: string
  /** The requirement it counts toward, when there is one. */
  groupTitle?: string
  /** Only set for `unlocks`, and only ever presented as a maybe. */
  unlockedBy?: string[]
  /** Is it actually available in the term being planned? */
  offered?: boolean
}

export interface RecommendInput {
  program: ProgramWithGroups | null
  /** Everything passed, plus everything currently registered — a course you are
   *  taking right now should not be suggested back to you. */
  taken: string[]
  catalog: CatalogEntry[]
  /** Codes with a published section in the term being planned, if known. */
  offeredCodes?: string[]
}

const codeOf = (c: CatalogEntry) => `${c.subject} ${c.catalog}`

/**
 * What's left, ranked.
 *
 * Required first, then elective fills, then the speculative unlocks — and the
 * caller is expected to render that last group differently, because it is a
 * different kind of statement.
 */
export function recommend(input: RecommendInput, limit = 12): Suggestion[] {
  const { program, taken, catalog, offeredCodes } = input
  const done = new Set(taken.map(normalizeCode))
  const offered = offeredCodes ? new Set(offeredCodes.map(normalizeCode)) : null
  const seen = new Set<string>()
  const out: Suggestion[] = []

  const byCode = new Map(catalog.map((c) => [normalizeCode(codeOf(c)), c]))
  const push = (s: Suggestion) => {
    const key = normalizeCode(s.code)
    if (done.has(key) || seen.has(key)) return
    seen.add(key)
    out.push({ ...s, offered: offered ? offered.has(key) : undefined })
  }

  // ── 1. Named requirements you have not finished ──────────────────────────
  if (program) {
    for (const group of program.groups) {
      if (group.kind !== 'all') continue
      for (const course of group.courses) {
        if (done.has(normalizeCode(course.code))) continue
        const entry = byCode.get(normalizeCode(course.code))
        push({
          code: course.code,
          title: entry?.title || course.title,
          credits: course.credits,
          reason: 'required',
          groupTitle: group.title,
          because: `Required for ${group.title}.`,
        })
      }
    }

    // ── 2. Mechanical elective rules, only where the bucket is unfilled ────
    for (const group of program.groups) {
      const pattern = group.pattern
      if (!pattern) continue
      const earned = catalog
        .filter((c) => done.has(normalizeCode(codeOf(c))) && matchesPattern(codeOf(c), pattern))
        .reduce((sum, c) => sum + c.credits, 0)
      const short = group.credits - earned
      if (short <= 0) continue
      for (const c of catalog) {
        if (!matchesPattern(codeOf(c), pattern)) continue
        push({
          code: codeOf(c),
          title: c.title,
          credits: c.credits,
          reason: 'elective',
          groupTitle: group.title,
          because: `Counts toward ${group.title} — ${short} credit${short === 1 ? '' : 's'} still to fill.`,
        })
      }
    }
  }

  // ── 3. Doors your record has opened ──────────────────────────────────────
  // A heuristic, and the copy says so. We look for a course whose prerequisite
  // text names something already passed. We do NOT decide the student is
  // eligible: the prose may say "COMP 248 and COMP 249", and we only saw one.
  for (const c of catalog) {
    const prose = c.prerequisites
    if (!prose) continue
    const hits = extractCodes(prose).filter((code) => done.has(normalizeCode(code)))
    if (hits.length === 0) continue
    push({
      code: codeOf(c),
      title: c.title,
      credits: c.credits,
      reason: 'unlocks',
      unlockedBy: hits,
      because: `Its prerequisites mention ${hits.join(', ')}, which you have.`,
    })
  }

  return rank(out).slice(0, limit)
}

/**
 * Order: certainty first, availability second.
 *
 * Within a tier, something actually offered next term outranks something that
 * is not, because a suggestion you cannot act on is trivia.
 */
const TIER: Record<SuggestionReason, number> = { required: 0, elective: 1, unlocks: 2 }

export function rank(list: Suggestion[]): Suggestion[] {
  return [...list].sort((a, b) => {
    if (TIER[a.reason] !== TIER[b.reason]) return TIER[a.reason] - TIER[b.reason]
    const ao = a.offered === false ? 1 : 0
    const bo = b.offered === false ? 1 : 0
    if (ao !== bo) return ao - bo
    return a.code.localeCompare(b.code)
  })
}

/** Course codes inside a sentence. Shape only — the words between them ("and",
 *  "or", "one of") are exactly what we refuse to interpret. */
export function extractCodes(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/\b([A-Z]{3,4})\s?-?\s?(\d{3}[A-Z]?)\b/g)) {
    out.add(`${m[1]} ${m[2]}`)
  }
  return [...out]
}

/** Named requirements still outstanding, for the "what's left" summary that
 *  sits above the suggestions. */
export function outstandingRequired(
  program: ProgramWithGroups | null,
  taken: string[],
): RequirementCourse[] {
  if (!program) return []
  const done = new Set(taken.map(normalizeCode))
  return program.groups
    .filter((g) => g.kind === 'all')
    .flatMap((g) => g.courses)
    .filter((c) => !done.has(normalizeCode(c.code)))
}
