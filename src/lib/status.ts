import type { AssessmentStatus } from '@/data/types'
import { daysUntil, formatFull, relativeDueLabel } from './date'

/** Statuses that still need action — these are what Today's due list surfaces. */
const OPEN: ReadonlySet<AssessmentStatus> = new Set<AssessmentStatus>([
  'not-started',
  'in-progress',
  'extension',
])

export function isOpen(status: AssessmentStatus): boolean {
  return OPEN.has(status)
}

/** The lightweight transitions Today's quick-status control offers. */
export const QUICK_STATUSES: AssessmentStatus[] = ['done', 'late', 'missed']

/** The statuses the editor offers, in lifecycle order. "Overdue" isn't here —
 * it's derived from the due date, not set by hand. `awaiting-grade` = handed in,
 * waiting on a mark. */
export const EDITOR_STATUSES: AssessmentStatus[] = [
  'not-started',
  'in-progress',
  'extension',
  'done',
  'awaiting-grade',
  'late',
  'missed',
]

/** Shared status vocabulary + colors so Today and Courses read identically.
 * Lives here (not in StatusBadge) so non-component modules can read it too. */
export const STATUS_META: Record<
  AssessmentStatus,
  { label: string; dot: string; text: string }
> = {
  'not-started': { label: 'Not started', dot: 'bg-subtle', text: 'text-subtle' },
  'in-progress': { label: 'In progress', dot: 'bg-info', text: 'text-info' },
  done: { label: 'Done', dot: 'bg-success', text: 'text-success' },
  late: { label: 'Done late', dot: 'bg-warning', text: 'text-warning' },
  missed: { label: 'Missed', dot: 'bg-danger', text: 'text-danger' },
  extension: { label: 'Extension', dot: 'bg-accent', text: 'text-accent' },
  'awaiting-grade': { label: 'Awaiting grade', dot: 'bg-accent', text: 'text-accent' },
}

/** Status-aware due label. A resolved item is NEVER "overdue" — on-time-vs-late
 * is carried by its STATUS, set by you, never guessed from the date. So an
 * imported assignment that's already past but you actually did on time reads
 * "Done" when you mark it `done`; mark it `late` ("Done late") only if you truly
 * finished after the deadline. Only items still OPEN past their date read
 * "X days overdue". `neutral` is the caller's color for non-urgent labels (Today
 * wants its due text prominent → 'text-fg'; the editor wants it subtle). */
export function dueLabel(
  due: string,
  status: AssessmentStatus,
  neutral = 'text-subtle',
): { label: string; tone: string } {
  const days = daysUntil(due)
  if (isOpen(status)) {
    return {
      label: relativeDueLabel(due),
      tone: days < 0 ? 'text-danger' : days === 0 ? 'text-warning' : neutral,
    }
  }
  // Resolved → just the date. The status badge (Done / Done late / Missed /
  // Awaiting grade) says how it ended; we never infer "late" from the date.
  return { label: days < 0 ? formatFull(due) : relativeDueLabel(due), tone: neutral }
}
