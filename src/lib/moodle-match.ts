/**
 * Matching a Moodle deadline to an assessment you already have.
 *
 * Moodle and your syllabus describe the same coursework twice, so when a
 * professor moves a date in Moodle the app holds both the new date (synced)
 * and the old one (your assessment, with its weight and your grade on it). The
 * one that matters to your GPA is the one that does not update. This finds the
 * pairs so the stale one can say so.
 *
 * PURE — no React, no Supabase, no clock read. The matching is the risky part
 * and it has to be checkable without a browser.
 *
 * THE BAR IS DELIBERATELY HIGH. A false match offers to move the wrong
 * deadline, and a student who accepts one wrong suggestion stops trusting all
 * of them. So: the course must match, the title must match after the noise is
 * stripped, and anything short or generic is refused. Missing a real match
 * costs a notification; inventing one costs the feature's credibility.
 */
import { normalizeTitle } from '@/features/courses/duplicate-assessments'

/** Moodle's own phrasing, stripped so the activity's real name is left. */
const MOODLE_VERBS =
  /\s+(is\s+due|due|opens?|closes?|has\s+closed|is\s+open|submission\s+deadline|deadline)\s*$/i

/** "COMM 305", "COMP248", "COMM-305" anywhere, so a code prefix can be removed. */
const CODE = /\b([A-Za-z]{3,4})[\s-]?(\d{3}[A-Za-z]?)\b/g

/**
 * "COMM 305 Assignment 2 is due" → "Assignment 2".
 *
 * Both halves matter: Moodle prefixes the course and suffixes a verb, and
 * neither is part of what the professor called the thing. Applied repeatedly
 * because a title can carry more than one verb phrase ("Quiz 1 opens").
 */
export function stripMoodleTitle(summary: string): string {
  let s = summary.replace(CODE, ' ')
  let before = ''
  while (before !== s) {
    before = s
    s = s.replace(MOODLE_VERBS, '')
  }
  return s.replace(/\s+/g, ' ').trim()
}

/** The course codes mentioned anywhere in a string (Moodle puts one in CATEGORIES). */
export function codesIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(CODE)) out.push(`${m[1].toUpperCase()} ${m[2].toUpperCase()}`)
  return out
}

/**
 * Do two titles name the same thing?
 *
 * Equality after normalising is the strong case. Containment is allowed only
 * when the shorter side is substantial — "Assignment 2" inside "Assignment 2
 * (group)" is the same work, but "quiz" inside "quiz 4" is five different
 * quizzes and matching those would move the wrong one.
 */
export function titlesMatch(a: string, b: string): boolean {
  const x = normalizeTitle(a)
  const y = normalizeTitle(b)
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  // Under 8 characters a containment match is mostly luck, and a title with no
  // digit ("quiz", "exam", "lab") names a category rather than an item.
  if (short.length < 8 || !/\d/.test(short)) return false
  return long.includes(short)
}

export interface MoodleTask {
  id: string
  title: string
  due: string
  note?: string
  source?: string
}

export interface MatchableAssessment {
  id: string
  courseId: string
  title: string
  due: string | null
}

export interface MatchableCourse {
  id: string
  code: string
}

/** One assessment whose date disagrees with Moodle's. */
export interface MoodleMismatch {
  assessmentId: string
  courseId: string
  /** The assessment's title, so the card names what the student recognises. */
  title: string
  /** What the assessment currently says. */
  yourDue: string
  /** What Moodle says now. */
  moodleDue: string
  /** The synced item it was matched against — shown so the match is checkable. */
  viaTitle: string
}

/** Same calendar day in local terms — a time-only difference is not a move. */
function sameLocalDay(a: string, b: string): boolean {
  const x = new Date(a)
  const y = new Date(b)
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime())) return false
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  )
}

/**
 * Every assessment Moodle disagrees with.
 *
 * Only DAY-level differences are reported. Moodle stores 23:59 and a syllabus
 * often says "end of day", so reporting a difference of minutes would fire on
 * almost every pair and mean nothing.
 *
 * An assessment with no date is skipped rather than matched: "Moodle moved
 * this" is the wrong sentence for an item that never had a date, and filling
 * one in from a fuzzy match is exactly the confident-wrong-answer this app
 * avoids. (Those are already handled as "date not set" on Today.)
 */
export function findMoodleMismatches(
  tasks: MoodleTask[],
  assessments: MatchableAssessment[],
  courses: MatchableCourse[],
): MoodleMismatch[] {
  const moodle = tasks.filter((t) => t.source === 'moodle' && t.due)
  if (moodle.length === 0) return []

  const byCode = new Map<string, string>() // "COMM 305" -> courseId
  for (const c of courses) {
    for (const code of codesIn(c.code)) byCode.set(code, c.id)
  }

  const out: MoodleMismatch[] = []
  const claimed = new Set<string>() // one suggestion per assessment

  for (const task of moodle) {
    // The course comes from the Moodle event's own text — its CATEGORIES line
    // carries the course short name, and the title usually repeats it. Without
    // a course we do not guess: a title alone matches across classes.
    const hay = `${task.title} ${task.note ?? ''}`
    const courseId = codesIn(hay)
      .map((code) => byCode.get(code))
      .find(Boolean)
    if (!courseId) continue

    const core = stripMoodleTitle(task.title)
    if (!core) continue

    for (const a of assessments) {
      if (a.courseId !== courseId || !a.due || claimed.has(a.id)) continue
      if (!titlesMatch(core, a.title)) continue
      if (sameLocalDay(a.due, task.due)) continue
      claimed.add(a.id)
      out.push({
        assessmentId: a.id,
        courseId,
        title: a.title,
        yourDue: a.due,
        moodleDue: task.due,
        viaTitle: task.title,
      })
      break
    }
  }
  return out
}
