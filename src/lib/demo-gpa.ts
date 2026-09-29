/**
 * A presentation-only GPA floor, for showing the product to people.
 *
 * THE HARD RULE: this NEVER writes. It transforms a number on its way to the
 * screen and touches no stored grade, so turning it off restores the truth
 * exactly and there is no path by which a fabricated mark reaches the database.
 * That is why it lifts the GPA FIGURE rather than rewriting each course — a
 * boosted row on an editable list is one mis-click away from being saved as
 * real, and a transcript that has silently been improved is a far worse bug
 * than an unflattering number.
 *
 * Admin-only and opt-out; see `SettingsProvider`. It is deliberately obvious in
 * Settings rather than silent, because a demo aid nobody remembers enabling
 * becomes a lie the next time somebody reads their own record.
 */
const KEY = 'ct_demo_gpa'

/** Concordia's scale tops out at 4.30, so a target above it is not showable. */
export const DEMO_GPA_TARGET = 4.1
export const DEMO_GPA_MAX = 4.3

export function demoGpaEnabled(): boolean {
  try {
    // Default ON: it exists so the site looks right when handed to someone,
    // and a demo aid that needs switching on before every demo gets forgotten.
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

const subs = new Set<() => void>()
/** In-memory copy, so a toggle takes effect even where storage is blocked. */
let current: boolean | null = null

export function setDemoGpaEnabled(on: boolean): void {
  current = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode — it just will not persist */
  }
  // Every GPA on screen re-reads it: the switch used to change nothing until
  // the page that showed the figure was remounted.
  subs.forEach((f) => f())
}

/** For `useSyncExternalStore` (see `useShownGpa`). */
export function subscribeDemoGpa(f: () => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}
export function demoGpaSnapshot(): boolean {
  return current ?? demoGpaEnabled()
}

/**
 * Raise a GPA to the demo floor, never lower it.
 *
 * A real 4.2 stays 4.2: the point is that the number never looks bad, not that
 * it always reads the same. Null (nothing graded yet) stays null — inventing a
 * GPA for an empty record would show a figure where the product's own answer is
 * "there is nothing here yet".
 */
export function demoGpa(real: number | null, enabled: boolean): number | null {
  if (!enabled || real === null) return real
  return Math.min(DEMO_GPA_MAX, Math.max(real, DEMO_GPA_TARGET))
}
