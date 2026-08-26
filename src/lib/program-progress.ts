import { normalizeCode } from './prereq'
import { parseCourseCode } from './course-sections'

/**
 * Degree requirements, and how far through them somebody is.
 *
 * Pure — no Supabase import — so the one thing here that could quietly ruin
 * somebody's graduation can be checked in Node. The fetchers live in
 * `programs.ts`; the arithmetic lives here.
 *
 * That arithmetic is deliberately conservative. A requirement group that names
 * its courses is ticked off exactly; a group that says "14 credits chosen from
 * Computer Science courses at the 300 level or above, subject to exclusions" is
 * NOT guessed at, because getting it wrong means telling a student they can
 * graduate when they cannot. Those groups show the calendar's own wording and
 * count nothing.
 *
 * The middle case is a group whose rule is genuinely mechanical — "18 credits of
 * additional 400-level courses offered by the Department" is a subject and a
 * level, with no exclusion list hiding in it. Those carry a `pattern`, and they
 * ARE counted. The distinction is not how confident we feel; it is whether the
 * calendar's sentence can be written down without losing anything.
 *
 * What we can honestly offer instead is the leftover: total credits completed,
 * minus the ones already claimed by a named group. That is a fact rather than
 * an inference, and it is the number an advisor would start from too.
 */

export interface RequirementCourse {
  code: string
  title: string
  credits: number
}

/**
 * A mechanical elective rule: a subject, optionally bounded by course level.
 *
 * Deliberately cannot express anything more. The moment a rule needs "except"
 * or "at most one of", it is prose again and belongs in `rule` with no pattern,
 * because a half-understood exclusion is how a student gets told they have
 * finished a degree they have not.
 */
export interface GroupPattern {
  subject: string
  min_catalog?: number
  max_catalog?: number
}

export interface RequirementGroup {
  id: string
  position: number
  title: string
  kind: 'all' | 'credits'
  credits: number
  courses: RequirementCourse[]
  rule: string | null
  note: string | null
  /** Present only when the rule is checkable without interpretation. */
  pattern?: GroupPattern | null
}

export interface Program {
  id: string
  /** A major inherits its degree's groups. Null for a degree itself. */
  parent_id?: string | null
  name: string
  faculty: string
  degree: string
  total_credits: number
  calendar_year: string
  source_url: string
}

export interface ProgramWithGroups extends Program {
  groups: RequirementGroup[]
}

// ── Progress ────────────────────────────────────────────────────────────────

export interface GroupProgress {
  group: RequirementGroup
  /** Named courses already done. Empty for a 'credits' group. */
  done: RequirementCourse[]
  /** Named courses still outstanding. Empty for a 'credits' group. */
  remaining: RequirementCourse[]
  earnedCredits: number
  requiredCredits: number
  /** False when the group's rule is prose we refuse to interpret. */
  counted: boolean
  /** Courses counted toward a pattern group. Empty for the other kinds. */
  matched: CompletedCourse[]
}

/** Does this course satisfy the group's rule? Code-shape only — no exclusions,
 *  because a pattern that needed one would not have been written. */
export function matchesPattern(code: string, pattern: GroupPattern): boolean {
  const parsed = parseCourseCode(code)
  if (!parsed) return false
  if (parsed.subject !== pattern.subject.toUpperCase()) return false
  const n = parseInt(parsed.catalog, 10)
  if (Number.isNaN(n)) return false
  if (pattern.min_catalog !== undefined && n < pattern.min_catalog) return false
  if (pattern.max_catalog !== undefined && n > pattern.max_catalog) return false
  return true
}

export interface ProgramProgress {
  groups: GroupProgress[]
  /** Credits from groups we can check exactly. */
  earnedNamed: number
  requiredNamed: number
  /** Everything the student has passed, whether or not it maps to a group. */
  totalCompletedCredits: number
  /**
   * Completed credits not claimed by any named group. These probably go toward
   * the elective requirements — "probably" is why it is shown as its own
   * number and never added into a completion percentage.
   */
  unassignedCredits: number
  /** Named requirements only. Deliberately not "percent of degree". */
  percentNamed: number
}

export interface CompletedCourse {
  code: string
  credits: number
}

/**
 * Work out where somebody stands.
 *
 * `completed` is every course they have passed, with its credit value. Matching
 * is on the normalised code, so "COMP248", "comp 248" and "COMP-248" are the
 * same course — students type all three and the calendar uses a fourth.
 */
export function computeProgress(
  program: ProgramWithGroups,
  completed: CompletedCourse[],
): ProgramProgress {
  const have = new Map(completed.map((c) => [normalizeCode(c.code), c]))
  const claimed = new Set<string>()

  // TWO PASSES, and the order is load-bearing. Named groups claim their courses
  // first; pattern groups then take only what is left. Accountancy is exactly
  // why: ACCO 310 is a required course AND matches the "9 credits of additional
  // ACCO courses" rule, so a single pass would count it twice and hand someone
  // three credits they have not earned.
  const groups: GroupProgress[] = program.groups.map((group) => {
    if (group.kind !== 'all') {
      return {
        group,
        done: [],
        remaining: [],
        matched: [],
        earnedCredits: 0,
        requiredCredits: group.credits,
        counted: false,
      }
    }
    const done: RequirementCourse[] = []
    const remaining: RequirementCourse[] = []
    for (const course of group.courses) {
      const key = normalizeCode(course.code)
      if (have.has(key)) {
        done.push(course)
        claimed.add(key)
      } else {
        remaining.push(course)
      }
    }
    return {
      group,
      done,
      remaining,
      matched: [],
      // The group's own credit value for each course, not the student's — a
      // transcript that records COMP 248 as 3 does not change what the degree
      // requires.
      earnedCredits: done.reduce((sum, c) => sum + c.credits, 0),
      requiredCredits: group.credits,
      counted: true,
    }
  })

  // Second pass: the mechanical elective rules, over whatever is unclaimed.
  for (const g of groups) {
    const pattern = g.group.pattern
    if (g.counted || !pattern) continue
    const matched = completed.filter(
      (c) => !claimed.has(normalizeCode(c.code)) && matchesPattern(c.code, pattern),
    )
    for (const c of matched) claimed.add(normalizeCode(c.code))
    g.matched = matched
    // Capped at what the group asks for: passing 24 credits of FINA electives
    // does not make an 18-credit requirement 133% complete, it makes it done.
    g.earnedCredits = Math.min(
      g.group.credits,
      matched.reduce((sum, c) => sum + c.credits, 0),
    )
    g.counted = true
  }

  const named = groups.filter((g) => g.counted)
  const earnedNamed = named.reduce((sum, g) => sum + g.earnedCredits, 0)
  const requiredNamed = named.reduce((sum, g) => sum + g.requiredCredits, 0)

  const totalCompletedCredits = completed.reduce((sum, c) => sum + c.credits, 0)
  const unassignedCredits = completed
    .filter((c) => !claimed.has(normalizeCode(c.code)))
    .reduce((sum, c) => sum + c.credits, 0)

  return {
    groups,
    earnedNamed,
    requiredNamed,
    totalCompletedCredits,
    unassignedCredits,
    percentNamed: requiredNamed === 0 ? 0 : Math.round((earnedNamed / requiredNamed) * 100),
  }
}
