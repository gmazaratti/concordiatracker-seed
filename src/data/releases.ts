/**
 * The product's release history — the single source for the version-history view
 * and the "what's new" notification. Mock + in-memory like the rest of the seed.
 *
 * To cut a new release: add an entry at the TOP of `RELEASES` (newest first).
 * `CURRENT_VERSION` and the notification logic read from index 0 automatically.
 */

export type ReleaseChangeKind = 'new' | 'improved' | 'fixed'

export interface ReleaseChange {
  kind: ReleaseChangeKind
  text: string
}

export interface Release {
  /** Semver, e.g. "1.3.0". */
  version: string
  /** Short, human title for the release. */
  name: string
  /** Release date, `YYYY-MM-DD`. */
  date: string
  changes: ReleaseChange[]
}

/** Newest first — index 0 is the current release. */
export const RELEASES: Release[] = [
  {
    version: '1.3.0',
    name: 'Calendar, in context',
    date: '2026-06-17',
    changes: [
      { kind: 'new', text: 'Calendar with Month, Week, and Agenda views.' },
      { kind: 'new', text: 'Concordia academic dates and your deadlines as toggleable layers.' },
      { kind: 'new', text: 'Add personal tasks and notes to any day.' },
      { kind: 'improved', text: 'Upgrade prompts collapse to a slim bar on mobile.' },
      { kind: 'improved', text: 'Today reads calmer — less per-row clutter.' },
      { kind: 'fixed', text: 'The sidebar no longer scrolls away from the profile block.' },
    ],
  },
  {
    version: '1.2.0',
    name: 'Settings & polish',
    date: '2026-06-15',
    changes: [
      { kind: 'new', text: 'A floating Settings panel: profile, billing, usage, and privacy.' },
      { kind: 'new', text: 'Custom date & time picker and dropdowns that never clip.' },
      { kind: 'new', text: '“How is this calculated?” shows the math behind every grade.' },
      { kind: 'improved', text: 'Scrollbars now follow the active theme.' },
      { kind: 'fixed', text: 'The settings toggle knob stays inside its track.' },
    ],
  },
  {
    version: '1.1.0',
    name: 'Courses, reimagined',
    date: '2026-06-15',
    changes: [
      { kind: 'new', text: 'Google-Classroom-style course cards with per-class colors.' },
      { kind: 'new', text: 'Command palette: edit a grade or open a class from anywhere.' },
      { kind: 'improved', text: 'Smart grade field — type 15/20 and it reads 75%.' },
      { kind: 'improved', text: 'A roomier course detail panel for instructor and logistics.' },
    ],
  },
  {
    version: '1.0.0',
    name: 'Hello, ConcordiaTracker',
    date: '2026-06-14',
    changes: [
      { kind: 'new', text: 'Today and Courses, with editable mock grades.' },
      { kind: 'new', text: 'A working grade-needed calculator and GPA what-if.' },
      { kind: 'new', text: 'The syllabus parse-reveal and two themes (dark + Concordia maroon).' },
    ],
  },
]

/** The current (latest) version. */
export const CURRENT_VERSION = RELEASES[0].version

/** Semver compare: negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}
