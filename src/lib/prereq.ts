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

// The docs say a subject code is 4 characters. The live catalogue disagrees:
// MBA, BTM and others are 3, and 4-digit catalogue numbers exist too (COMP
// 5261). Requiring exactly 4 and 3 silently dropped every one of their
// prerequisites, which is why "Prerequisite:MBA 642" read as unparseable.
const CODE = /\b([A-Z]{3,4})\s?(\d{3,4}[A-Z]?)\b/

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
 * Concordia writes prerequisites in TWO dialects, and both have to be read.
 *
 * The calendar website uses prose:
 *   "The following courses must be completed previously: COMP 233 or ENGR 371; COMP 352."
 *
 * The Open Data API uses a terser, more structured form, which is 36% of the
 * catalogue and was invisible until the mirror was populated with real rows:
 *   "Course Prerequisite: One of (COMM226 or COMM301). Never Taken: DESC483"
 *   "Never Taken/Not Registered: ACCO213, ACCO218, ACCO230"
 *   "Course Prerequisite: ELEC 242 or 364"
 *
 * Three things about the API dialect that a naive reader gets wrong:
 *   - "One of (A, B, C)" is an OR group, but a comma OUTSIDE those brackets is
 *     an AND separator, so comma handling depends on position.
 *   - "Never Taken" and "Not Registered" are ANTIREQUISITES. Reading them as
 *     requirements would invert the answer completely: it would tell a student
 *     to go take the very course that disqualifies them.
 *   - A bare number inherits the preceding subject, so "ELEC 242 or 364" means
 *     ELEC 364, not course 364 of nothing.
 *
 * The lead-in is also spelled at least eight ways in the live data, including
 * "PREREQ", "Prereq", "PREQUISITE" and the typo "Prerequisitie", so it is
 * matched loosely rather than exactly.
 */

/** "ELEC 242 or 364" -> "ELEC 242 or ELEC 364". */
function expandBareNumbers(text: string): string {
  let subject: string | null = null
  return text.replace(/\b([A-Z]{3,4})\s?(\d{3,4}[A-Z]?)\b|\b(\d{3,4}[A-Z]?)\b/g, (whole, subj, _num, bare) => {
    if (subj) {
      subject = subj
      // Left exactly as written. This text is shown to the student, and
      // rewriting "COMP 248" as "COMP248" would leak the parser's internals
      // into the UI for no gain.
      return whole
    }
    // A bare number only means a course if we have just seen a subject; a year
    // or a credit count would otherwise be turned into a course code.
    return subject ? `${subject} ${bare}` : whole
  })
}

const LEAD_IN =
  /(course\s+)?(pre-?req\w*|prereq\w*|prequisite\w*|prerequisitie\w*|co-?req\w*|corequisite\w*)\s*:?/i
const CONCURRENT_LEAD = /co-?req|corequisite/i
// "must not have taken" reads as a requirement to a careless matcher, and
// getting this backwards is the worst error the parser can make: it would tell
// a student to go and take the exact course that disqualifies them.
const ANTI_LEAD =
  /never\s+(have\s+)?taken|not\s+registered|must\s+not\s+have\s+taken|must\s+never\s+have\s+taken/i
const UNDECIDABLE_LEAD =
  /permission|reserved?\s|registration in|final year|honours program|program|students only|department is required/i

/**
 * Break the text into clauses.
 *
 * Splitting happens on a full stop, and on a semicolon ONLY when what follows
 * starts a new labelled clause. In the prose dialect a semicolon separates AND
 * terms inside one requirement list, so splitting on every semicolon would tear
 * those lists apart - the exact bug that made "COMP 233 or ENGR 371; COMP 352;
 * ENCS 282" unreadable.
 */
function clauses(text: string): string[] {
  const flat = text.replace(/\s+/g, ' ').trim()
  const out: string[] = []
  let buf = ''
  const parts = flat.split(/([.;])/)
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = parts[i]
    const sep = parts[i + 1] ?? ''
    const next = parts[i + 2] ?? ''
    buf += chunk + (sep === ';' ? ';' : '')
    const startsNewClause =
      sep === '.' || (sep === ';' && (LEAD_IN.test(next) || ANTI_LEAD.test(next)))
    if (startsNewClause) {
      if (buf.trim()) out.push(buf.replace(/;\s*$/, '').trim())
      buf = ''
    }
  }
  if (buf.trim()) out.push(buf.trim())
  return out.filter(Boolean)
}

function parseAlternative(raw: string): Alternative {
  const text = raw.trim().replace(/^(and|or)\s+/i, '').replace(/[.;()]+$/, '').trim()
  const m = text.match(CODE)
  return { code: m ? `${m[1]}${m[2]}` : null, text }
}

/**
 * Parse a requirement list into AND terms.
 *
 * "One of (...)" collapses to a single term whose alternatives are whatever is
 * inside the brackets. Outside brackets, ";" and "," separate AND terms and
 * " or " separates alternatives within one.
 */
function parseTermList(list: string, concurrent: boolean): Term[] {
  const terms: Term[] = []

  // Pull out every "One of (...)" group first, so its internal commas are not
  // mistaken for AND separators.
  const oneOf = /one\s+of\s*\(([^)]*)\)/gi
  let m: RegExpExecArray | null
  while ((m = oneOf.exec(list)) !== null) {
    const alternatives = m[1]
      .split(/,|\s+or\s+/i)
      .map(parseAlternative)
      .filter((a) => a.text.length > 0)
    if (alternatives.length > 0) terms.push({ alternatives, concurrent })
  }
  const rest = list.replace(oneOf, ' ')

  for (const chunk of rest.split(/[;,]/)) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    const alternatives = trimmed
      .split(/\s+or\s+/i)
      .map(parseAlternative)
      .filter((a) => a.text.length > 0)
    // A fragment with no course code and no meaningful words is punctuation
    // left behind by removing a bracket group.
    if (alternatives.length === 0) continue
    if (alternatives.every((a) => a.code === null && a.text.length < 3)) continue
    terms.push({ alternatives, concurrent })
  }
  return terms
}

function allCodes(text: string): string[] {
  return [...text.matchAll(new RegExp(CODE, 'g'))].map((m) => `${m[1]}${m[2]}`)
}

export function parsePrereq(raw: string | null | undefined): Prereq {
  const out: Prereq = { terms: [], antirequisites: [], minCredits: null, undecidable: [] }
  if (!raw?.trim()) return out
  const text = expandBareNumbers(raw)

  for (const s of clauses(text)) {
    // ── Antirequisites. Checked FIRST: several clauses contain both a
    // requirement lead-in and a "Never Taken" list, and reading the second as a
    // requirement would tell a student to take the course that disqualifies
    // them. Splitting on the antirequisite label keeps each half honest.
    const antiAt = s.search(ANTI_LEAD)
    if (antiAt >= 0) {
      const before = s.slice(0, antiAt)
      const after = s.slice(antiAt)
      out.antirequisites.push(...allCodes(after))
      if (LEAD_IN.test(before)) {
        const list = before.replace(LEAD_IN, '').trim()
        if (list) out.terms.push(...parseTermList(list, CONCURRENT_LEAD.test(before)))
      }
      continue
    }

    if (/may not (take|be taken).*for credit/i.test(s)) {
      out.antirequisites.push(...allCodes(s))
      continue
    }

    // A credit floor, in any of the phrasings the catalogue actually uses,
    // including the French "crédits". When the clause names no course at all,
    // the credit count IS the requirement rather than a detail of one, and we
    // know the student's total, so it is decidable either way.
    // Both orders occur: "48 credits" and "min number of credits: 6".
    const credits =
      s.match(/(\d{1,3})\s+cr[ée]dits?\b/i) ?? s.match(/cr[ée]dits?\s*:?\s*(\d{1,3})\b/i)
    if (
      credits &&
      (/must (complete|have completed)|prior to enrolling|minimum of|min number|completed/i.test(s) ||
        !CODE.test(s))
    ) {
      out.minCredits = Math.max(out.minCredits ?? 0, Number(credits[1]))
      continue
    }

    // The calendar's prose form.
    const prose = s.match(/must be completed (previously or concurrently|previously|concurrently)\s*:?\s*(.*)$/i)
    if (prose && prose[2].trim()) {
      out.terms.push(...parseTermList(prose[2], /concurrently/i.test(prose[1])))
      continue
    }

    // The API's labelled form, in any of its spellings.
    if (LEAD_IN.test(s)) {
      const list = s.replace(LEAD_IN, '').trim()
      if (list && CODE.test(list)) {
        out.terms.push(...parseTermList(list, CONCURRENT_LEAD.test(s)))
        continue
      }
    }

    // Some entries are just the code, with no label at all: SCUL 611's entire
    // prerequisite is the text "SCUL 610". If a clause is nothing but course
    // codes and separators, it can only be a requirement.
    if (CODE.test(s) && /^[\sA-Z0-9,;()]+$/i.test(s.replace(/\bor\b|\band\b/gi, ''))) {
      const terms = parseTermList(s, false)
      if (terms.length > 0) {
        out.terms.push(...terms)
        continue
      }
    }

    // Readable, but hinging on something we cannot see.
    if (UNDECIDABLE_LEAD.test(s)) {
      out.undecidable.push(s.replace(/\s*\.\s*$/, ''))
      continue
    }

    if (CODE.test(s)) out.undecidable.push(s.replace(/\s*\.\s*$/, ''))
  }

  // The same course named twice adds nothing and reads as noise.
  out.antirequisites = [...new Set(out.antirequisites)]
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
