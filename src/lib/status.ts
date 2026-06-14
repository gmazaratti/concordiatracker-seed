import type { AssessmentStatus } from '@/data/types'

/** Statuses that still need action — these are what Today's due list surfaces. */
const OPEN: ReadonlySet<AssessmentStatus> = new Set<AssessmentStatus>([
  'not-started',
  'extension',
])

export function isOpen(status: AssessmentStatus): boolean {
  return OPEN.has(status)
}

/** The lightweight transitions Today's quick-status control offers. */
export const QUICK_STATUSES: AssessmentStatus[] = ['done', 'late', 'missed']

/** Shared status vocabulary + colors so Today and Courses read identically.
 * Lives here (not in StatusBadge) so non-component modules can read it too. */
export const STATUS_META: Record<
  AssessmentStatus,
  { label: string; dot: string; text: string }
> = {
  'not-started': { label: 'Not started', dot: 'bg-subtle', text: 'text-subtle' },
  done: { label: 'Done', dot: 'bg-success', text: 'text-success' },
  late: { label: 'Late', dot: 'bg-warning', text: 'text-warning' },
  missed: { label: 'Missed', dot: 'bg-danger', text: 'text-danger' },
  extension: { label: 'Extension', dot: 'bg-info', text: 'text-info' },
  'awaiting-grade': { label: 'Awaiting grade', dot: 'bg-accent', text: 'text-accent' },
}
