import type { Assessment, Course } from '@/data/types'
import { KIND_LABEL } from './assessment'

/**
 * Term workload, week by week. Every assessment contributes its WEIGHT to the
 * week it falls in, so the chart answers "when does this term actually get
 * hard?" — not "how many things are there" (five 2% quizzes ≠ one 40% final).
 *
 * Pure arithmetic over the student's real dates, so the insight line can never
 * claim something the data doesn't say.
 */

export interface WorkloadWeek {
  /** 1-based week number within the term. */
  week: number
  /** Sum of assessment weights due this week. */
  weight: number
  items: Assessment[]
  /** Is this the week we're currently in? */
  current: boolean
}

const DAY_MS = 86_400_000

export function termWorkload(
  assessments: Assessment[],
  termStart: string,
  termEnd: string,
  now = Date.now(),
): WorkloadWeek[] {
  const start = new Date(termStart).getTime()
  const end = new Date(termEnd).getTime()
  if (!start || !end || end <= start) return []
  const totalWeeks = Math.max(1, Math.round((end - start) / (7 * DAY_MS)))
  const currentWeek = Math.min(
    totalWeeks,
    Math.max(1, Math.floor((now - start) / (7 * DAY_MS)) + 1),
  )

  const weeks: WorkloadWeek[] = Array.from({ length: totalWeeks }, (_, i) => ({
    week: i + 1,
    weight: 0,
    items: [],
    current: i + 1 === currentWeek,
  }))

  for (const a of assessments) {
    // A week bucket is a point in time; undated work has no bucket.
    if (!a.due) continue
    const due = new Date(a.due).getTime()
    if (!due || due < start) continue
    const idx = Math.floor((due - start) / (7 * DAY_MS))
    if (idx < 0 || idx >= totalWeeks) continue
    weeks[idx].weight += a.weight
    weeks[idx].items.push(a)
  }
  return weeks
}

/** The heaviest week of the term (null when nothing is scheduled). */
export function heaviestWeek(weeks: WorkloadWeek[]): WorkloadWeek | null {
  let best: WorkloadWeek | null = null
  for (const w of weeks) if (w.weight > 0 && (!best || w.weight > best.weight)) best = w
  return best
}

/**
 * A plain-English sentence about the heaviest week — built from the actual
 * items, so it never overstates. Returns null when there's nothing to say.
 */
export function workloadInsight(
  weeks: WorkloadWeek[],
  courses: Course[],
): { week: number; text: string; parts: string[] } | null {
  const peak = heaviestWeek(weeks)
  if (!peak || peak.items.length === 0) return null

  // Group by kind, ranked by how much WEIGHT each kind carries that week — so
  // the sentence leads with what actually matters, not what's most numerous.
  const byKind = new Map<string, { n: number; weight: number }>()
  for (const item of peak.items) {
    const cur = byKind.get(item.kind) ?? { n: 0, weight: 0 }
    cur.n += 1
    cur.weight += item.weight
    byKind.set(item.kind, cur)
  }
  const ranked = [...byKind.entries()].sort((a, b) => b[1].weight - a[1].weight)
  const describe = ([kind, v]: (typeof ranked)[number]) => {
    const label = (KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind).toLowerCase()
    return v.n === 1 ? `${article(label)} ${label}` : `${numberWord(v.n)} ${label}s`
  }

  const total = Math.round(peak.weight)
  const count = peak.items.length
  // Naming every kind gets unreadable past three, so long weeks lead with the
  // two heaviest and state the true total — never a partial sum dressed as one.
  const parts = ranked.map(describe)
  const detail =
    count <= 3
      ? `${joinList(parts)} worth ${total}% together`
      : `${count} items worth ${total}% together, led by ${joinList(ranked.slice(0, 2).map(describe))}`

  // Name the course that dominates the week, so the advice is actionable.
  const heaviestItem = [...peak.items].sort((a, b) => b.weight - a.weight)[0]
  const code = courses.find((c) => c.id === heaviestItem.courseId)?.code
  const advice = code ? ` Start the ${code} prep early.` : ''

  return {
    week: peak.week,
    text: `Week ${peak.week} is the heavy one: ${detail}.${advice}`,
    parts,
  }
}

/** "a project" vs "an assignment". */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

function numberWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n)
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return 'nothing'
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}
