import type { AssessmentKind, Provenance } from '@/data/types'

/** armed → reach (cursor to the word) → grab (click, PDF lifts out) → drag → drop
 * (into scanner) → scanning → revealing (cascade) → done. */
export type Phase = 'armed' | 'reach' | 'grab' | 'drag' | 'drop' | 'scanning' | 'revealing' | 'done'

/** Display-only filler for the landing parse beat, lifted from the real syllabus
 * the user dropped (COMM 221 GG — Financial Markets, Winter 2026). Local to the
 * landing (not in mock.ts) because its dates are the syllabus's own calendar
 * dates, not the runtime-relative dates the app's seed invariant requires. */
export type ParsedItem = {
  id: string
  kind: AssessmentKind
  title: string
  weight: number
  due: string
  provenance: Provenance
}

export const COMM221_PARSED: ParsedItem[] = [
  { id: 'q1', kind: 'quiz', title: 'Quiz 1 — Time value & NPV', weight: 8, due: 'Feb 8', provenance: { status: 'official' } },
  { id: 'q2', kind: 'quiz', title: 'Quiz 2 — Risk, CAPM & ESG', weight: 8, due: 'Feb 22', provenance: { status: 'official' } },
  { id: 'q3', kind: 'quiz', title: 'Quiz 3 — Markets & equilibria', weight: 8, due: 'Mar 15', provenance: { status: 'official' } },
  { id: 'q4', kind: 'quiz', title: 'Quiz 4 — Resource allocation', weight: 8, due: 'Mar 29', provenance: { status: 'official' } },
  { id: 'q5', kind: 'quiz', title: 'Quiz 5 — Finance history & regulation', weight: 8, due: 'Apr 5', provenance: { status: 'official' } },
  { id: 'final', kind: 'final', title: 'Final Common Exam', weight: 60, due: 'Apr · exam period', provenance: { status: 'confirmed', confirmations: 9 } },
]

/** The raw grade-composition table as it reads on the page — the "before" the
 * parser turns into the structured plan on the right. */
export const RAW_ROWS: [string, string, string][] = [
  ['Quiz 1 (Moodle, online)', '8%', 'Feb 8'],
  ['Quiz 2 (Moodle, online)', '8%', 'Feb 22'],
  ['Quiz 3 (Moodle, online)', '8%', 'Mar 15'],
  ['Quiz 4 (Moodle, online)', '8%', 'Mar 29'],
  ['Quiz 5 (Moodle, online)', '8%', 'Apr 5'],
  ['Final Common Exam (in-person)', '60%', 'TBA'],
]
