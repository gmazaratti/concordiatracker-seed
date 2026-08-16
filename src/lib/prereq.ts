/**
 * Reading Concordia's prerequisite prose properly.
 *
 * An earlier version only pulled the course codes out of the sentence and
 * checked whether you had all of them, which was wrong in a way that mattered:
 * "COMP 232 or COEN 231" would report COEN 231 as missing for someone who took
 * COMP 232. The sentences turn out to be highly templated, so most of the logic
 * IS parseable, and refusing to parse it was under-serving the student.
 *
 * The real grammar, from the calendar:
 *
 *   "The following course must be completed previously: COMP 248."
 *   "The following courses must be completed previously: COMP 233 or ENGR 371; COMP 352; ENCS 282."
 *   "The following courses must be completed previously or concurrently: MATH 203 or Cegep Mathematics 103 or NYA; MATH 204."
 *   "The following courses must be completed previously: COMP 232 or COEN 231; and COMP 249 or COEN 244."
 *   "The following course must be completed previously: MATH 201 or equivalent."
 *   "Students who have received credit for COMP 248 or COEN 243 may not take this course for credit."
 *   "Students must complete 60 credits prior to enrolling."
 *   "Permission of the Department is required."
 *
 * So: ";" (and a leading "and") separates AND terms, " or " separates
 * alternatives inside a term, and several sentence types are not requirements
 * at all.
 *
 * What it will NOT do is guess. An alternative that is not a course code
 * ("equivalent", "Cegep Mathematics 103", "NYA") could well be satisfied by
 * transfer credit we cannot see, so it yields UNKNOWN rather than a refusal —
 * and a permission clause yields UNKNOWN no matter what else is true. Being
 * unsure is a real answer here; a confident wrong one costs someone a semester.
 */

const CODE = /\b([A-Z]{4})\s?(\d{3}[A-Z]?)\b/

export type Verdict = 'met' | 'not-met' | 'unknown' | 'blocked'

export interface Alternative {
  /** A course code, normalised as "COMP248". Null for non-course wording. */
  code: string | null
  /** What the calendar actually said, for display. */
  text: string
}

export interface Term {
  /** Any ONE of these satisfies the term. */
  alternatives: Alternative[]
  /** "previously or concurrently" — you may take it at the same time. */
  concurrent: boolean
}

export interface Prereq {
  /** Every term must be satisfied. */
  terms: Term[]
  /** Courses that make this one unavailable for credit. */
  antirequisites: string[]
  /** A credit floor, e.g. 60. */
  minCredits: number | null
  /** Clauses we can read but cannot decide: permission, standing, programs. */
  undecidable: string[]
}

export interface Evaluation {
  verdict: Verdict
  /** Unsatisfied terms, as their alternatives, for "you still need X or Y". */
  missing: Term[]
  /** Why the answer is unknown, or why it is blocked. Shown verbatim. */
  notes: string[]
  /** True when nothing in the sentence could be interpreted at all. */
  unreadable: boolean
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Split into sentences.
 *
 * ONLY on a full stop. Semicolons look like sentence breaks — they are always
 * followed by a capitalised course code — but ";" is this grammar's AND
 * operator, and splitting on it tears "COMP 233 or ENGR 371; COMP 352; ENCS 282"
 * into fragments that no longer parse as a requirement list.
 */
function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/\.\s+(?=[A-Z"“])|\.\s*$/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseAlternative(raw: string): Alternative {
  const text = raw.trim().replace(/^(and|or)\s+/i, '').replace(/[.;]+$/, '').trim()
  const m = text.match(CODE)
  return { code: m ? `${m[1]}${m[2]}` : null, text }
}

/**
 * Parse the requirement list that follows the colon.
 *
 * ";" separates terms that must ALL hold; " or " separates alternatives within
 * one term. A term is also allowed to start with "and", which the calendar uses
 * for emphasis rather than as a separate operator.
 */
function parseTermList(list: string, concurrent: boolean): Term[] {
  return list
    .split(/;/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({
      alternatives: chunk.split(/\s+or\s+/i).map(parseAlternative).filter((a) => a.text.length > 0),
      concurrent,
    }))
    .filter((t) => t.alternatives.length > 0)
}

export function parsePrereq(text: string | null | undefined): Prereq {
  const out: Prereq = { terms: [], antirequisites: [], minCredits: null, undecidable: [] }
  if (!text?.trim()) return out

  for (const s of sentences(text)) {
    // Antirequisite: having one of these makes the course unavailable.
    if (/may not (take|be taken).*for credit/i.test(s)) {
      for (const m of s.matchAll(new RegExp(CODE, 'g'))) {
        out.antirequisites.push(`${m[1]}${m[2]}`)
      }
      continue
    }

    // A credit floor. We know the student's credit total, so this is decidable.
    const credits = s.match(/(\d{2,3})\s+credits?\b/i)
    if (credits && /must (complete|have completed)|prior to enrolling|minimum of/i.test(s)) {
      out.minCredits = Math.max(out.minCredits ?? 0, Number(credits[1]))
      continue
    }

    // The main requirement form.
    const req = s.match(/must be completed (previously or concurrently|previously|concurrently)\s*:?\s*(.*)$/i)
    if (req) {
      const concurrent = /concurrently/i.test(req[1])
      const list = req[2]
      if (list.trim()) {
        out.terms.push(...parseTermList(list, concurrent))
        continue
      }
    }

    // Older / alternate phrasing that still names the requirement after a colon.
    const colon = s.match(/^(?:pre-?requisites?|co-?requisites?)\s*:?\s*(.+)$/i)
    if (colon) {
      out.terms.push(...parseTermList(colon[1], /concurrent/i.test(s)))
      continue
    }

    // Permission, standing, program registration: readable, not decidable.
    if (/permission|registration in|final year|honours program|department is required/i.test(s)) {
      out.undecidable.push(s.replace(/\s*\.\s*$/, ''))
      continue
    }

    // Anything else that mentions a course but does not match a known shape.
    if (CODE.test(s)) out.undecidable.push(s.replace(/\s*\.\s*$/, ''))
  }

  return out
}

export interface Record {
  /** Normalised codes of finished courses. */
  completed: Set<string>
  /** Credits earned, for a credit-floor clause. */
  credits: number
}

/**
 * Decide whether a student meets a prerequisite.
 *
 * Four outcomes, and the distinction between the last two is the point:
 *   met       — every term is satisfied and nothing is in the way.
 *   not-met   — a term has named courses and you have none of them.
 *   unknown   — it hinges on something we cannot see (permission, an
 *               "equivalent", a Cegep course, program standing).
 *   blocked   — you already hold an antirequisite, so it cannot be taken.
 */
export function evaluate(p: Prereq, rec: Record): Evaluation {
  const notes: string[] = []

  const held = p.antirequisites.filter((c) => rec.completed.has(c))
  if (held.length > 0) {
    return {
      verdict: 'blocked',
      missing: [],
      notes: [`You already have credit for ${held.join(', ')}, which excludes this course.`],
      unreadable: false,
    }
  }

  const missing: Term[] = []
  let unsure = false

  for (const term of p.terms) {
    const satisfied = term.alternatives.some((a) => a.code !== null && rec.completed.has(a.code))
    if (satisfied) continue
    // An alternative we cannot check ("or equivalent", a Cegep course) means we
    // cannot say this term is unmet — only that we cannot confirm it.
    const escapable = term.alternatives.some((a) => a.code === null)
    if (escapable) {
      unsure = true
      notes.push(`Might be covered by: ${term.alternatives.map((a) => a.text).join(' or ')}`)
    } else {
      missing.push(term)
    }
  }

  if (p.minCredits !== null && rec.credits < p.minCredits) {
    missing.push({
      alternatives: [{ code: null, text: `${p.minCredits} credits (you have ${rec.credits})` }],
      concurrent: false,
    })
  }

  for (const u of p.undecidable) {
    unsure = true
    notes.push(u)
  }

  const unreadable =
    p.terms.length === 0 && p.antirequisites.length === 0 && p.minCredits === null

  if (missing.length > 0) return { verdict: 'not-met', missing, notes, unreadable }
  if (unsure) return { verdict: 'unknown', missing: [], notes, unreadable }
  return { verdict: 'met', missing: [], notes, unreadable }
}

/** Parse and evaluate in one step. */
export function checkPrereq(text: string | null | undefined, rec: Record): Evaluation {
  return evaluate(parsePrereq(text), rec)
}

/** "COMP232 or COEN231" — how a missing term reads in the UI. */
export function describeTerm(t: Term): string {
  return t.alternatives.map((a) => a.text).join(' or ')
}
