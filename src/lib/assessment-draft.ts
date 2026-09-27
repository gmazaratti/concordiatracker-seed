import type { AssessmentStatus, Grade } from '@/data/types'
import { gradeToInput, readGradeInput } from './grade'

/**
 * What an assessment editor is holding that the store does not.
 *
 * Every field is `null` until the student actually touches it, and an
 * untouched field is NOT part of the save. That rule is the whole point:
 * the editor used to copy the stored grade into its own state once, on mount,
 * so a grade saved somewhere else afterwards (the "what did you get?" prompt
 * after marking it done) left the editor holding the old empty text. The next
 * save — "Mark not done", say — then compared that empty text against the new
 * grade, called it a change, and wrote "no grade" over it.
 */
export interface AssessmentDraft {
  status: AssessmentStatus | null
  gradeText: string | null
}

export const EMPTY_DRAFT: AssessmentDraft = { status: null, gradeText: null }

interface Stored {
  status: AssessmentStatus
  grade: Grade | null
}

/** The value to show in each field: the edit if there is one, else the store. */
export function draftView(stored: Stored, draft: AssessmentDraft) {
  return {
    status: draft.status ?? stored.status,
    gradeText: draft.gradeText ?? gradeToInput(stored.grade),
  }
}

/**
 * The patch a save should write, or `invalid` when the typed grade cannot be
 * read (unreadable text is never "no grade"). Only fields the student changed
 * AND that differ from the store are included, so a status-only save can never
 * carry a grade.
 */
export function draftPatch(
  stored: Stored,
  draft: AssessmentDraft,
): { kind: 'invalid'; error: string } | { kind: 'patch'; patch: Partial<Stored> } {
  const patch: Partial<Stored> = {}
  if (draft.status !== null && draft.status !== stored.status) patch.status = draft.status
  if (draft.gradeText !== null) {
    const read = readGradeInput(draft.gradeText)
    if (read.kind === 'invalid') return { kind: 'invalid', error: read.error }
    const next = read.kind === 'grade' ? read.grade : null
    if (gradeToInput(next) !== gradeToInput(stored.grade)) patch.grade = next
  }
  return { kind: 'patch', patch }
}
