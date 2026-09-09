/**
 * Spotting an assessment you already have.
 *
 * Importing an outline into a course that already has one is a normal thing to
 * do — a professor reposts a corrected syllabus, or you typed three items by
 * hand and then found the blueprint. Without this it silently doubles
 * everything, and the first sign is a grade breakdown adding to 200%.
 *
 * PURE, so the matching can be checked without a parser or a network. It never
 * deletes anything on its own: it says "this looks like the one you already
 * have" and the student decides. Getting that backwards would quietly discard a
 * real second midterm because it shared a name with the first.
 */
export interface Existing {
  id: string
  title: string
  kind: string
  weight: number
  due: string | null
}

export interface Incoming {
  title: string
  kind: string
  weight: number
  due: string | null
}

export interface Duplicate {
  /** The existing assessment this looks like. */
  id: string
  title: string
  /** Why we think so, in words the student can check us on. */
  reason: string
  /** High enough to default to skipping it. */
  confident: boolean
}

/** Lowercased, punctuation and filler stripped: "Assignment #1" -> "assignment 1". */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Same calendar day, in local terms. Null on either side is not a match. */
function sameDay(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/**
 * The one existing assessment an incoming row most likely duplicates.
 *
 * Ordered by how much a match is worth, and only the top two are treated as
 * confident. An identical title is the strongest signal there is; a same-day,
 * same-weight, same-kind item is the next, because that is what a reposted
 * syllabus looks like after someone renamed "Quiz 1" to "Quiz #1".
 *
 * Same kind and weight ALONE is deliberately not confident: five quizzes worth
 * 8% each would all match each other, and defaulting those to skip would drop
 * four real assessments.
 */
export function findDuplicate(incoming: Incoming, existing: Existing[]): Duplicate | null {
  const title = normalizeTitle(incoming.title)

  for (const e of existing) {
    if (title && normalizeTitle(e.title) === title) {
      return { id: e.id, title: e.title, reason: 'same title', confident: true }
    }
  }

  for (const e of existing) {
    if (
      e.kind === incoming.kind &&
      e.weight === incoming.weight &&
      sameDay(e.due, incoming.due)
    ) {
      return {
        id: e.id,
        title: e.title,
        reason: 'same date, weight and type',
        confident: true,
      }
    }
  }

  for (const e of existing) {
    if (e.kind === incoming.kind && sameDay(e.due, incoming.due)) {
      return { id: e.id, title: e.title, reason: 'same date and type', confident: false }
    }
  }

  return null
}

/** Every incoming row paired with what it looks like, in one pass. */
export function matchAll(
  incoming: Incoming[],
  existing: Existing[],
): (Duplicate | null)[] {
  return incoming.map((i) => findDuplicate(i, existing))
}
