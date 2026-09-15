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
  // Under 8 characters a containment match is mostly luck: "quiz", "lab" and
  // "exam" name a category, not an item.
  if (short.length < 8) return false
  // THE NUMBERS MUST AGREE EXACTLY. This is what keeps containment safe —
  // "assignment" would otherwise swallow "assignment 2", and "midterm exam"
  // would swallow "midterm exam 2". Comparing the digit runs rather than
  // demanding one lets "group project" match "group project report", which is
  // the same piece of work written two ways, while still refusing every pair
  // that disagrees about WHICH one it is.
  if (numbersIn(short) !== numbersIn(long)) return false
  return long.includes(short)
}

/** The digit runs in order: "quiz 1 part 2" -> "1,2". */
function numbersIn(s: string): string {
  return (s.match(/\d+/g) ?? []).join(',')
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

/** One synced item paired with the assessment it duplicates. */
export interface MoodlePair {
  taskId: string
  assessmentId: string
  courseId: string
  /** The assessment's title — what the student recognises. */
  title: string
  /** What the assessment says, or null if it never had a date. */
  yourDue: string | null
  /** What Moodle says. */
  moodleDue: string
  /** The Moodle event's own name, so a match can be checked not trusted. */
  viaTitle: string
  /** True when the two disagree about the DAY. */
  differs: boolean
}

/**
 * Pair every synced Moodle item with the assessment it is a second copy of.
 *
 * This is the answer to "will I see everything twice?". Moodle and your
 * syllabus describe the same coursework, so without pairing, a class with five
 * assignments in both places shows ten rows. A pair lets the app render the
 * ASSESSMENT — the record that carries the weight and your grade — and drop
 * the synced duplicate, while `differs` still surfaces a professor's change.
 *
 * Unpaired Moodle items are NOT noise: "Join a Group (Due date)" is a real
 * deadline that no syllabus lists. Those are the ones worth showing on their
 * own.
 */
export function pairMoodleToAssessments(
  tasks: MoodleTask[],
  assessments: MatchableAssessment[],
  courses: MatchableCourse[],
): MoodlePair[] {
  const moodle = tasks.filter((t) => t.source === 'moodle' && t.due)
  if (moodle.length === 0) return []

  const byCode = new Map<string, string>() // "COMM 305" -> courseId
  for (const c of courses) {
    for (const code of codesIn(c.code)) byCode.set(code, c.id)
  }

  const pairs: MoodlePair[] = []
  const claimed = new Set<string>() // one assessment cannot be two things

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
      if (a.courseId !== courseId || claimed.has(a.id)) continue
      if (!titlesMatch(core, a.title)) continue
      claimed.add(a.id)
      pairs.push({
        taskId: task.id,
        assessmentId: a.id,
        courseId,
        title: a.title,
        yourDue: a.due,
        moodleDue: task.due,
        viaTitle: task.title,
        // An assessment with no date cannot have been "moved" — it never had
        // a date to move from. Pairing it still hides the duplicate; it just
        // does not claim a change.
        differs: a.due !== null && !sameLocalDay(a.due, task.due),
      })
      break
    }
  }
  return pairs
}

/** The ids of synced items that are already on screen as an assessment. */
export function coveredTaskIds(pairs: MoodlePair[]): Set<string> {
  return new Set(pairs.map((p) => p.taskId))
}

/**
 * Every assessment Moodle disagrees with — the subset of pairs where the day
 * is different, which is the only kind worth interrupting anyone about.
 *
 * Only DAY-level differences count. Moodle stores 23:59 and a syllabus often
 * says "end of day", so a difference of minutes would fire on nearly every
 * pair and mean nothing.
 */
export function findMoodleMismatches(
  tasks: MoodleTask[],
  assessments: MatchableAssessment[],
  courses: MatchableCourse[],
): MoodleMismatch[] {
  return pairMoodleToAssessments(tasks, assessments, courses)
    .filter((p) => p.differs && p.yourDue)
    .map((p) => ({
      assessmentId: p.assessmentId,
      courseId: p.courseId,
      title: p.title,
      yourDue: p.yourDue as string,
      moodleDue: p.moodleDue,
      viaTitle: p.viaTitle,
    }))
}

/**
 * Concordia's Moodle names a course `SUBJ-CAT-TERM-SECTION`, e.g.
 * `FINA-210-2262-B`, and puts that in every event's CATEGORIES line.
 *
 * Which means the feed does not only carry deadlines — it carries the list of
 * classes the student is IN, with the term and the section. That is the whole
 * "import my courses" feature, already in the payload.
 *
 * The code is taken confidently (it is the part every format agrees on); the
 * term and section are best-effort and simply absent when the name does not
 * match the pattern. A Moodle course called "Chemistry Help Centre" yields
 * nothing at all, which is correct.
 */
const MOODLE_COURSE = /\b([A-Za-z]{3,4})-(\d{3}[A-Za-z]?)(?:-(\d{4}))?(?:-([A-Za-z0-9]{1,4}))?\b/

export interface MoodleCourseHint {
  /** "FINA 210" — normalised, ready to match the catalogue. */
  code: string
  /** Concordia's 4-digit term, when the name carried one. */
  termCode?: string
  /** The section letter(s), when the name carried them. */
  section?: string
  /** How many events named it — a course with one event is still a course. */
  events: number
}

/**
 * The distinct courses a Moodle feed mentions.
 *
 * ONLY COURSES WITH EVENTS APPEAR, and the UI has to say so: a class whose
 * professor has posted no deadlines is invisible here, and presenting this as
 * "your courses" when it is "your courses that have posted something" would
 * be the kind of confident-but-wrong claim this app tries not to make.
 */
export function coursesFromMoodle(tasks: MoodleTask[]): MoodleCourseHint[] {
  const found = new Map<string, MoodleCourseHint>()
  for (const t of tasks) {
    if (t.source !== 'moodle') continue
    // The category is what Moodle puts in `note` ahead of any description.
    const category = (t.note ?? '').split('·')[0]?.trim() ?? ''
    const m = MOODLE_COURSE.exec(category) ?? MOODLE_COURSE.exec(t.title)
    if (!m) continue
    const code = `${m[1].toUpperCase()} ${m[2].toUpperCase()}`
    const prev = found.get(code)
    found.set(code, {
      code,
      // Keep the first term/section seen; later events should agree, and if
      // they do not, the earlier one is no worse a guess than the later.
      termCode: prev?.termCode ?? m[3],
      section: prev?.section ?? m[4]?.toUpperCase(),
      events: (prev?.events ?? 0) + 1,
    })
  }
  return [...found.values()].sort((a, b) => a.code.localeCompare(b.code))
}
