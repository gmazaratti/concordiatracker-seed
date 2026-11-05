/**
 * Co-op eligibility, from Concordia's own published rules (checked 2026-11-05).
 *
 * WHAT CO-OP ACTUALLY USES: the cumulative GPA (CGPA) in your program. No
 * page we found computes it over your last N credits. The "last 24 credits"
 * number is shown as well because students ask for it (it is how recent
 * terms are trending), but it is labelled as ours, not Concordia's rule.
 *
 * Pure: no React, no Supabase, so the arithmetic is Node-checked.
 */

export interface CoopRule {
  /** Minimum CGPA to be admitted to co-op. */
  entry: number
  /** Minimum CGPA to stay in co-op. */
  stay: number
  /** Where the numbers come from, for the "check it" link. */
  source: string
}

const COOP_ADMISSION = 'https://www.concordia.ca/academics/co-op/programs/undergraduate.html'

/** Arts and Science sets an entry threshold per program (co-op admission page). */
const ARTS_SCIENCE: [RegExp, number][] = [
  [/actuarial/i, 3.5],
  [/mathematical and computational finance/i, 3.7],
  [/political science|pure and applied math|statistics|translation/i, 3.3],
  [/biology|cell and molecular|data science|ecology|economics|environmental and sustainability/i, 3.0],
  [/anthropology|biochemistry|chemistry|journalism|physics|sociology/i, 2.7],
]

export function coopRule(faculty: string | null | undefined, program: string | null | undefined): CoopRule | null {
  const f = faculty ?? ''
  const p = program ?? ''
  if (/gina cody|engineering and computer science/i.test(f)) return { entry: 2.5, stay: 2.5, source: COOP_ADMISSION }
  if (/john molson|jmsb/i.test(f) || /commerce|bcomm/i.test(p)) return { entry: 3.0, stay: 2.7, source: COOP_ADMISSION }
  if (/arts and science/i.test(f)) {
    for (const [re, entry] of ARTS_SCIENCE) if (re.test(p)) return { entry, stay: entry, source: COOP_ADMISSION }
  }
  return null
}

export interface GradedLine {
  credits: number
  /** Grade points on the 4.30 scale. */
  points: number
  /** Ordering key: higher = more recent term. */
  rank: number
  graded: boolean
  superseded: boolean
}

/**
 * GPA over the most recent `window` credits: newest graded courses first,
 * whole courses only, stopping once the window is reached. Null when there
 * are no graded credits at all. Also returns how many credits it used, so the
 * UI can say "over your last 24.5 credits" honestly.
 */
export function recentGpa(lines: GradedLine[], window = 24): { gpa: number; credits: number } | null {
  const usable = lines.filter((l) => l.graded && !l.superseded && l.credits > 0).sort((a, b) => b.rank - a.rank)
  let credits = 0
  let points = 0
  for (const l of usable) {
    if (credits >= window) break
    credits += l.credits
    points += l.points * l.credits
  }
  if (credits === 0) return null
  return { gpa: points / credits, credits }
}
