/**
 * Concordia's official academic calendar — Summer 2026 · Fall 2026 · Winter 2027,
 * transcribed from the registrar's "Academic Calendar Dates" (graduate calendar).
 * A curated, student-relevant subset (term boundaries, exam periods, reading
 * weeks, closures, add/drop + withdrawal + graduation deadlines); the niche
 * graduate-admin rows (thesis submission, AFE funding, Quebec-resident status,
 * leave of absence) are intentionally left out for calm — drop them in here later.
 *
 * Dates are absolute (`YYYY-MM-DD`, local). `end` makes a multi-day range
 * (inclusive). Swap this whole array to load a different year/program.
 */
export type AcademicKind = 'term' | 'exam' | 'break' | 'holiday' | 'deadline'

export interface AcademicEvent {
  id: string
  title: string
  /** Inclusive start, `YYYY-MM-DD` local. */
  start: string
  /** Inclusive end for multi-day events. */
  end?: string
  kind: AcademicKind
}

export const ACADEMIC_CALENDAR: AcademicEvent[] = [
  // ── Summer 2026 ───────────────────────────────────────────────
  { id: 'su26-winter-exams-end', title: 'Winter exams end', start: '2026-05-03', kind: 'exam' },
  { id: 'su26-classes-begin', title: 'Summer classes begin', start: '2026-05-11', kind: 'term' },
  { id: 'su26-victoria', title: 'Victoria Day / Patriots’ Day — closed', start: '2026-05-18', kind: 'holiday' },
  { id: 'su26-add', title: 'Add & DNE refund deadline — summer', start: '2026-05-19', kind: 'deadline' },
  { id: 'su26-disc1', title: 'Withdrawal (DISC) deadline — 1st-term summer', start: '2026-06-10', kind: 'deadline' },
  { id: 'su26-reeval', title: 'Course re-evaluation deadline', start: '2026-06-15', kind: 'deadline' },
  { id: 'su26-convocation', title: 'Spring convocations', start: '2026-06-15', kind: 'term' },
  { id: 'su26-last-1st', title: 'Last day of classes — 1st-term summer', start: '2026-06-22', kind: 'term' },
  { id: 'su26-finals-1st', title: 'Summer finals — 1st-term', start: '2026-06-23', end: '2026-06-30', kind: 'exam' },
  { id: 'su26-reading-2t', title: 'Reading week — 2nd-term summer', start: '2026-06-23', end: '2026-06-30', kind: 'break' },
  { id: 'su26-fete', title: 'Fête nationale — closed', start: '2026-06-24', kind: 'holiday' },
  { id: 'su26-canada', title: 'Canada Day — closed', start: '2026-07-01', kind: 'holiday' },
  { id: 'su26-grad-fall', title: 'Fall graduation application deadline', start: '2026-07-01', kind: 'deadline' },
  { id: 'su26-classes-2nd', title: 'Classes begin — 2nd-term summer', start: '2026-07-02', kind: 'term' },
  { id: 'su26-add-2nd', title: 'Add & DNE refund deadline — 2nd-term summer', start: '2026-07-09', kind: 'deadline' },
  { id: 'su26-disc2', title: 'Withdrawal (DISC) — 2nd-term summer', start: '2026-07-22', kind: 'deadline' },
  { id: 'su26-reg-fall', title: 'Fall registration opens (Independent students)', start: '2026-07-29', kind: 'deadline' },
  { id: 'su26-disc-2t', title: 'Withdrawal (DISC) — two-term summer', start: '2026-07-31', kind: 'deadline' },
  { id: 'su26-last', title: 'Last day of classes — summer', start: '2026-08-12', kind: 'term' },
  { id: 'su26-finals', title: 'Summer finals — two-term & 2nd-term', start: '2026-08-13', end: '2026-08-18', kind: 'exam' },

  // ── Fall 2026 ─────────────────────────────────────────────────
  { id: 'fa26-labour', title: 'Labour Day — closed', start: '2026-09-07', kind: 'holiday' },
  { id: 'fa26-classes-begin', title: 'Fall classes begin', start: '2026-09-08', kind: 'term' },
  { id: 'fa26-add', title: 'Add & DNE refund deadline — fall', start: '2026-09-21', kind: 'deadline' },
  { id: 'fa26-reeval', title: 'Course re-evaluation deadline', start: '2026-10-01', kind: 'deadline' },
  { id: 'fa26-reading', title: 'Reading week — fall', start: '2026-10-10', end: '2026-10-16', kind: 'break' },
  { id: 'fa26-thanksgiving', title: 'Thanksgiving — closed', start: '2026-10-12', kind: 'holiday' },
  { id: 'fa26-grad-winter', title: 'Winter graduation application deadline', start: '2026-11-01', kind: 'deadline' },
  { id: 'fa26-disc', title: 'Withdrawal (DISC) deadline — fall', start: '2026-11-16', kind: 'deadline' },
  { id: 'fa26-last', title: 'Last day of classes — fall', start: '2026-12-07', kind: 'term' },
  { id: 'fa26-finals', title: 'Fall finals', start: '2026-12-09', end: '2026-12-22', kind: 'exam' },
  { id: 'fa26-closure', title: 'Holiday closure', start: '2026-12-24', end: '2027-01-05', kind: 'holiday' },

  // ── Winter 2027 ───────────────────────────────────────────────
  { id: 'wi27-classes-begin', title: 'Winter classes begin', start: '2027-01-11', kind: 'term' },
  { id: 'wi27-grad-spring', title: 'Spring graduation application deadline', start: '2027-01-15', kind: 'deadline' },
  { id: 'wi27-add', title: 'Add & DNE refund deadline — winter', start: '2027-01-25', kind: 'deadline' },
  { id: 'wi27-convocation', title: 'Fall convocations', start: '2027-01-26', kind: 'term' },
  { id: 'wi27-reeval', title: 'Course re-evaluation deadline', start: '2027-02-01', kind: 'deadline' },
  { id: 'wi27-reading', title: 'Reading week — winter', start: '2027-03-01', end: '2027-03-07', kind: 'break' },
  { id: 'wi27-president', title: 'President’s Holiday — closed', start: '2027-03-05', kind: 'holiday' },
  { id: 'wi27-disc', title: 'Withdrawal (DISC) deadline — winter', start: '2027-03-22', kind: 'deadline' },
  { id: 'wi27-easter', title: 'Easter closure', start: '2027-03-26', end: '2027-03-29', kind: 'holiday' },
  { id: 'wi27-last', title: 'Last day of classes — winter', start: '2027-04-12', kind: 'term' },
  { id: 'wi27-finals', title: 'Winter finals', start: '2027-04-15', end: '2027-05-02', kind: 'exam' },
]
