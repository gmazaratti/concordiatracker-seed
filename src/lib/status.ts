import type { AssessmentStatus } from '@/data/types'
import { activeLang, daysUntil, formatFull, relativeDueLabel } from './date'

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
 * Lives here (not in StatusBadge) so non-component modules can read it too.
 *
 * `label` is a lazy getter over the active language — same reason as
 * KIND_LABEL: this is read from plain modules, not only from components. */
const STATUS_LABEL_EN: Record<AssessmentStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  done: 'Done',
  late: 'Done late',
  missed: 'Missed',
  extension: 'Extension',
  'awaiting-grade': 'Awaiting grade',
}

const STATUS_LABEL_FR: Record<AssessmentStatus, string> = {
  'not-started': 'Pas commencé',
  'in-progress': 'En cours',
  done: 'Fait',
  late: 'Fait en retard',
  missed: 'Manqué',
  extension: 'Prolongation',
  'awaiting-grade': 'En attente de note',
}

const STATUS_COLORS: Record<AssessmentStatus, { dot: string; text: string }> = {
  'not-started': { dot: 'bg-subtle', text: 'text-subtle' },
  'in-progress': { dot: 'bg-info', text: 'text-info' },
  done: { dot: 'bg-success', text: 'text-success' },
  late: { dot: 'bg-warning', text: 'text-warning' },
  missed: { dot: 'bg-danger', text: 'text-danger' },
  extension: { dot: 'bg-accent', text: 'text-accent' },
  'awaiting-grade': { dot: 'bg-accent', text: 'text-accent' },
}

export const STATUS_META = {} as Record<
  AssessmentStatus,
  { label: string; dot: string; text: string }
>
for (const status of Object.keys(STATUS_COLORS) as AssessmentStatus[]) {
  STATUS_META[status] = {
    ...STATUS_COLORS[status],
    get label() {
      return activeLang() === 'fr' ? STATUS_LABEL_FR[status] : STATUS_LABEL_EN[status]
    },
  }
}

/** Status-aware due label. A resolved item is NEVER "overdue" — on-time-vs-late
 * is carried by its STATUS, set by you, never guessed from the date. So an
 * imported assignment that's already past but you actually did on time reads
 * "Done" when you mark it `done`; mark it `late` ("Done late") only if you truly
 * finished after the deadline. Only items still OPEN past their date read
 * "X days overdue". `neutral` is the caller's color for non-urgent labels (Today
 * wants its due text prominent → 'text-fg'; the editor wants it subtle). */
export function dueLabel(
  due: string | null,
  status: AssessmentStatus,
  neutral = 'text-subtle',
): { label: string; tone: string } {
  const days = daysUntil(due)
  // An undated item is never late and never urgent, so it takes the neutral
  // tone and the "not set" wording rather than a colour that implies a deadline.
  if (!due) return { label: relativeDueLabel(null), tone: neutral }
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
