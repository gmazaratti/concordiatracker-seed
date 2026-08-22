import { supabase } from './supabase'

/**
 * "This is wrong" and "my course is missing".
 *
 * Everything the app shows about a class that it did not get from the student —
 * the meeting pattern, the credit value, the title, whether the course exists at
 * all — came from a mirror of Concordia's calendar that is only as fresh as the
 * last sync. A student looking at their own portal is a better source than we
 * are, and the only thing worse than being wrong is being wrong with no way to
 * say so.
 *
 * Filing a report never blocks the student. The course is created, the field is
 * editable, and the report is what lets the mirror catch up.
 */
export type DataReportKind = 'course_info' | 'missing_course' | 'section'

export interface DataReportInput {
  kind: DataReportKind
  courseCode?: string
  courseId?: string
  field?: string
  currentValue?: string
  suggestedValue?: string
  note?: string
  payload?: Record<string, unknown>
}

export async function fileDataReport(input: DataReportInput): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return false
  const { error } = await supabase.from('data_reports').insert({
    user_id: uid,
    kind: input.kind,
    course_code: input.courseCode ?? null,
    course_id: input.courseId ?? null,
    field: input.field ?? null,
    current_value: input.currentValue ?? null,
    suggested_value: input.suggestedValue ?? null,
    note: input.note ?? null,
    payload: input.payload ?? {},
  })
  return !error
}

/** The fields worth reporting on, in the order they appear in the panel. */
export const REPORTABLE_FIELDS: { value: string; label: string }[] = [
  { value: 'meetingTimes', label: 'Meeting times' },
  { value: 'location', label: 'Room / location' },
  { value: 'section', label: 'Section' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'credits', label: 'Credits' },
  { value: 'title', label: 'Course title' },
  { value: 'other', label: 'Something else' },
]
