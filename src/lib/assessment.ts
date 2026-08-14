import type { AssessmentKind } from '@/data/types'
import { activeLang } from './date'

/** Human label for each assessment kind. Shared so Today and Courses read the
 * same vocabulary (avoids a per-component copy).
 *
 * Read as `KIND_LABEL[kind]` from ~a dozen components, several of which aren't
 * React components at all, so the values are lazy GETTERS over the active
 * language instead of a hook. `Object.keys(KIND_LABEL)` still works (the
 * properties are enumerable), and every call site stays untouched. */
const EN: Record<AssessmentKind, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  midterm: 'Midterm',
  final: 'Final',
  lab: 'Lab',
  reading: 'Reading',
  project: 'Project',
}

const FR: Record<AssessmentKind, string> = {
  assignment: 'Travail',
  quiz: 'Quiz',
  midterm: 'Mi-session',
  final: 'Examen final',
  lab: 'Laboratoire',
  reading: 'Lecture',
  project: 'Projet',
}

export const KIND_LABEL = {} as Record<AssessmentKind, string>
for (const kind of Object.keys(EN) as AssessmentKind[]) {
  Object.defineProperty(KIND_LABEL, kind, {
    enumerable: true,
    get: () => (activeLang() === 'fr' ? FR[kind] : EN[kind]),
  })
}
