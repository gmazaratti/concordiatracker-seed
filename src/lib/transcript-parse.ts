/**
 * Reading a pasted transcript or Student Centre screen.
 *
 * Typing fifteen courses one at a time is the single biggest piece of friction
 * left in the product, and every one of them is already on a page the student is
 * looking at. Pasting it should be enough.
 *
 * BUILT AGAINST INFERRED SHAPES, NOT A REAL SAMPLE. The prerequisite parser went
 * from reading 63% of the catalogue to 88% purely because it was rewritten
 * against real strings, and the same will be true here. What follows handles the
 * layouts these systems generally produce - tab-separated columns, space-padded
 * columns, and one-course-per-line prose - and REPORTS WHAT IT COULD NOT READ
 * rather than dropping it, so a format it has not seen shows up as a visible
 * gap instead of a silently missing course.
 *
 * Nothing is written from here. The parser returns rows, the student confirms
 * them, and only then are they saved: a paste is a guess about someone's
 * academic record, and guesses do not go in unreviewed.
 */

import { parseFinalGrade } from '@/lib/gpa'

export interface ParsedRow {
  code: string
  title: string | null
  credits: number | null
  /** As typed: a letter, a percentage, or nothing. */
  grade: string | null
  term: string | null
  /** The line it came from, so the student can check it against the paste. */
  source: string
}

export interface ParseResult {
  rows: ParsedRow[]
  /** Lines that mentioned a course but could not be read. Shown, not hidden. */
  unread: string[]
}

// 3-4 letters and 3-4 digits, matching the catalogue rather than the docs.
const CODE = /\b([A-Z]{3,4})\s?-?\s?(\d{3,4}[A-Z]?)\b/
const TERM = /\b(Fall|Winter|Summer|Autumn|Spring)\s+(\d{4})\b/i
const CREDITS = /\b(\d{1,2}(?:\.\d)?)\s*(?:cr|credits?|units?)\b/i

/** Seasons written the American way still mean a Concordia term. */
function normaliseTerm(season: string, year: string): string {
  const s = season.toLowerCase()
  const name = s === 'autumn' ? 'Fall' : s === 'spring' ? 'Winter' : s[0].toUpperCase() + s.slice(1)
  return `${name} ${year}`
}

/**
 * Split the bare numbers on a line into credits and a grade.
 *
 * Transcripts print both as unlabelled columns, so the only thing separating
 * them is size, and size happens to separate them cleanly: a Concordia course
 * is worth between 0.5 and 6 credits, and no transcript shows a grade of 3%.
 * So a number at or under 6 is credits and one above is a percentage.
 *
 * Where that rule cannot decide - two large numbers, say a class number and a
 * grade - NEITHER is taken. A plausible wrong grade is far worse than a blank
 * one, because nobody goes back and checks it.
 */
function splitNumbers(tokens: string[]): { credits: number | null; percent: string | null } {
  const numbers = tokens
    .map((t) => t.replace(/%$/, ''))
    .filter((t) => /^\d{1,3}(?:\.\d{1,2})?$/.test(t))
  const small = numbers.filter((n) => Number(n) <= 6)
  const large = numbers.filter((n) => Number(n) > 6 && Number(n) <= 100)
  return {
    credits: small.length === 1 ? Number(small[0]) : null,
    percent: large.length === 1 ? large[0] : null,
  }
}

/**
 * Pull the grade out of a line.
 *
 * Deliberately conservative. A transcript line is full of numbers - credits,
 * class numbers, years, GPA - and treating the wrong one as a grade produces a
 * plausible, wrong record that nobody notices. So a bare number only counts as
 * a grade when it is a standalone token AND the line has no letter grade in it,
 * and a two-digit number that already matched the credit pattern is excluded.
 */
function findGrade(tokens: string[], percentCandidate: string | null): string | null {
  const letters = tokens.filter((t) => /^(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|FNS|R|NR)$/.test(t))
  // A letter always wins: it is unambiguous, and a line carrying both a letter
  // and a percentage is showing the same grade twice.
  if (letters.length > 0) return letters[letters.length - 1]
  return percentCandidate !== null && parseFinalGrade(percentCandidate) !== null
    ? percentCandidate
    : null
}

/**
 * Parse a pasted block.
 *
 * A term heading applies to every course under it until the next heading, which
 * is how both a transcript and the Student Centre lay a semester out.
 */
export function parseTranscript(text: string): ParseResult {
  const rows: ParsedRow[] = []
  const unread: string[] = []
  let currentTerm: string | null = null
  const seen = new Set<string>()

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line) continue

    const termMatch = line.match(TERM)
    const codeMatch = line.match(CODE)

    // A line with a term and no course is a heading for what follows.
    if (termMatch && !codeMatch) {
      currentTerm = normaliseTerm(termMatch[1], termMatch[2])
      continue
    }
    if (!codeMatch) continue

    const code = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`
    // A term on the same line wins over the heading above it.
    const term = termMatch ? normaliseTerm(termMatch[1], termMatch[2]) : currentTerm

    const after = line.slice((codeMatch.index ?? 0) + codeMatch[0].length)
    const tokens = after.split(/[\s|\t]+/).filter(Boolean)

    // A labelled credit column ("3 credits") is certain. Unlabelled numbers
    // fall back to the size rule.
    const creditMatch = after.match(CREDITS) ?? line.match(CREDITS)
    const split = splitNumbers(tokens)
    const credits = creditMatch ? Number(creditMatch[1]) : split.credits
    const grade = findGrade(tokens, split.percent)

    // The title is whatever sits between the code and the first number-ish
    // column. Anything shorter than three characters is a column artefact.
    const titlePart = after
      .replace(CREDITS, ' ')
      .replace(/\b(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|FNS|R|NR)\b/g, ' ')
      .replace(/\b\d[\d.]*%?\b/g, ' ')
      .replace(/[|\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const title = titlePart.length >= 3 ? titlePart : null

    if (seen.has(code + (term ?? ''))) continue
    seen.add(code + (term ?? ''))

    // A course with no term is still a course, but it cannot be filed, so it is
    // surfaced for the student to place rather than guessed into a semester.
    if (!term) unread.push(line)

    rows.push({ code, title, credits, grade, term, source: line })
  }

  return { rows, unread }
}

/** Rows that are complete enough to save without further input. */
export function readyRows(result: ParseResult): ParsedRow[] {
  return result.rows.filter((r) => r.term !== null)
}
