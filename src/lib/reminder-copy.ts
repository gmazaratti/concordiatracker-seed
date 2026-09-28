/**
 * The words on an assignment reminder, in two voices.
 *
 * PURE and import-free on purpose: the phone composes its own local
 * notifications from this, and the server composes web pushes from the same
 * file (api/_run-reminders.ts imports it with an explicit .js extension), so a
 * reminder reads the same wherever it lands.
 *
 * COOL is the default: warm, a little cheeky, never mean, and never the same
 * line twice in a row. The line is picked by a hash of the assignment and the
 * lead time, so it is STABLE (the same reminder says the same thing if it is
 * rescheduled) while different reminders for one assignment, and the same lead
 * time across assignments, rotate through the pool.
 *
 * FORMAL is the plain sentence a school would send: "Assignment for COMM 305 -
 * Assignment 1 is due in one hour."
 */

export type ReminderTone = 'cool' | 'formal'

/** The lead times offered as presets, in minutes. */
export const REMINDER_PRESETS: readonly number[] = [15, 30, 60, 180, 360, 1440, 2880, 10080]

/** Used when the student has never touched the setting. */
export const DEFAULT_REMINDER_OFFSETS: readonly number[] = [1440, 60]

/** Offsets are minutes before the deadline; a month is the longest that means anything. */
export const MAX_REMINDER_MINUTES = 43_200
export const MAX_REMINDERS_PER_ITEM = 10

/** "30 minutes", "1 hour", "2 days". `words` spells out one ("one hour"). */
export function leadPhrase(minutes: number, words = false): string {
  const one = (unit: string) => (words ? `one ${unit}` : `1 ${unit}`)
  if (minutes % 10080 === 0) {
    const n = minutes / 10080
    return n === 1 ? one('week') : `${n} weeks`
  }
  if (minutes % 1440 === 0) {
    const n = minutes / 1440
    return n === 1 ? one('day') : `${n} days`
  }
  if (minutes % 60 === 0) {
    const n = minutes / 60
    return n === 1 ? one('hour') : `${n} hours`
  }
  return minutes === 1 ? one('minute') : `${minutes} minutes`
}

/** "1 hour before", for chips and settings. */
export function leadLabel(minutes: number): string {
  return `${leadPhrase(minutes)} before`
}

/** FNV-1a, 32-bit. Stable across the phone and the server. */
export function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

type Line = (v: { title: string; course: string; when: string }) => string

/** Two days out or more: there is time, which is exactly how it sneaks up. */
const FAR: Line[] = [
  (v) => `${v.title} is ${v.when} out. Future you would love a head start.`,
  (v) => `Plot twist: ${v.title} is due in ${v.when}. Start small, finish smug.`,
  (v) => `${v.title} is coming in ${v.when}. Get there before it gets to you.`,
  (v) => `${v.when} until ${v.title}. Plenty of time, which is how it always gets you.`,
  (v) => `A postcard from the future: ${v.course} wants ${v.title} in ${v.when}.`,
]

/** About a day out. */
const DAY: Line[] = [
  (v) => `Tomorrow's problem is ${v.title}. Make it today's win.`,
  (v) => `${v.title} is due in ${v.when}. You versus the deadline, round one.`,
  (v) => `${v.when} on the clock for ${v.title}. Tonight-you can save tomorrow-you.`,
  (v) => `${v.course} is expecting ${v.title} in ${v.when}. Let's not make it awkward.`,
  (v) => `${v.title}, ${v.when} to go. A little now beats a lot at 11:58.`,
]

/** A few hours out. */
const HOURS: Line[] = [
  (v) => `${v.title} is due in ${v.when}. Phone down, tabs open.`,
  (v) => `${v.when} left on ${v.title}. This is the part of the movie with the montage.`,
  (v) => `Clock's ticking on ${v.title}. You've got ${v.when}, and that's plenty.`,
  (v) => `${v.title}: ${v.when} to go. You've done harder things before breakfast.`,
  (v) => `${v.when} until ${v.title}. Deep breath, then one paragraph.`,
]

/** An hour or less. */
const FINAL: Line[] = [
  (v) => `${v.title} is due in ${v.when}. Hit submit and go be free.`,
  (v) => `Final call for ${v.title}. ${v.when} left.`,
  (v) => `${v.when}. That's it. ${v.title} is almost due.`,
  (v) => `Still time: ${v.title} closes in ${v.when}. Upload first, second-guess later.`,
  (v) => `${v.title} in ${v.when}. The finish line is right there.`,
]

function pool(minutes: number): Line[] {
  if (minutes <= 60) return FINAL
  if (minutes < 1440) return HOURS
  if (minutes < 2880) return DAY
  return FAR
}

export interface ReminderCopyInput {
  tone: ReminderTone
  /** The assessment's own name, e.g. "Assignment 1". */
  title: string
  /** "COMM 305"; blank when the course is unknown. */
  course: string
  offsetMinutes: number
  /** Anything stable per assignment (its id), for picking a line. */
  seed: string
}

export function reminderCopy(input: ReminderCopyInput): { title: string; body: string } {
  const title = input.title.trim() || 'Your assignment'
  const course = input.course.trim()
  if (input.tone === 'formal') {
    const subject = course ? `Assignment for ${course} - ${title}` : title
    return {
      title: course || 'Assignment due',
      body: `${subject} is due in ${leadPhrase(input.offsetMinutes, true)}.`,
    }
  }
  const lines = pool(input.offsetMinutes)
  const line = lines[hash32(`${input.seed}:${input.offsetMinutes}`) % lines.length]
  return {
    title: course ? `${course} · ${title}` : title,
    body: line({ title, course: course || 'Your class', when: leadPhrase(input.offsetMinutes) }),
  }
}

/** Defaults ∪ this item's own, deduped, sorted farthest first, within bounds. */
export function mergeOffsets(defaults: readonly number[], own: readonly number[] | undefined): number[] {
  const all = new Set<number>()
  for (const m of [...defaults, ...(own ?? [])]) {
    if (Number.isInteger(m) && m > 0 && m <= MAX_REMINDER_MINUTES) all.add(m)
  }
  return [...all].sort((a, b) => b - a)
}
