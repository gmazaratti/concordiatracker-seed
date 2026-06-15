import type { AssessmentKind } from '@/data/types'

/** Human label for each assessment kind. Shared so Today and Courses read the
 * same vocabulary (avoids a per-component copy). */
export const KIND_LABEL: Record<AssessmentKind, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  midterm: 'Midterm',
  final: 'Final',
  lab: 'Lab',
  reading: 'Reading',
  project: 'Project',
}
