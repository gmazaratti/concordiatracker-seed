import { supabase } from '@/lib/supabase'
// Re-exported so every existing import of `summarizeRecord` keeps working;
// the definitions moved to a pure module so they can be tested.
export { subjectOf, summarizeRecord, type RecordSummary } from '@/lib/record-summary'

/**
 * The academic record behind the planner: what you have finished, and what it
 * opens up.
 */

export interface SectionInstructor {
  section: string
  professor: string
  /** Published by the instructor of record through the teacher portal. */
  verified: boolean
  /** How many separate uploads name this person for this section. */
  reports: number
}

/**
 * Who teaches each section, from OUR data.
 *
 * Concordia's Open Data has no instructor field anywhere: the schedule feed's
 * 41 fields do not include one, and /course/faculty is faculty-and-department
 * structure, not people. So this is teacher-portal publications (authoritative)
 * and student uploads (reported), kept visibly apart rather than merged into a
 * single confident claim.
 */
export async function sectionInstructors(code: string): Promise<SectionInstructor[]> {
  const { data, error } = await supabase.rpc('section_instructors', { p_code: code })
  if (error) return []
  return (data ?? []) as SectionInstructor[]
}

/** Persist the two profile fields the planner adds. */
export async function saveAcademicProfile(patch: {
  yearOfStudy?: number | null
  minor?: string | null
  recordComplete?: boolean
}): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) return
  const row: Record<string, unknown> = {}
  if (patch.yearOfStudy !== undefined) row.year_of_study = patch.yearOfStudy
  if (patch.minor !== undefined) row.minor = patch.minor
  if (patch.recordComplete !== undefined) row.record_complete = patch.recordComplete
  if (Object.keys(row).length === 0) return
  await supabase.from('user_profile').update(row).eq('user_id', uid)
}

export async function loadAcademicProfile(): Promise<{
  yearOfStudy: number | null
  minor: string | null
  recordComplete: boolean
}> {
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) return { yearOfStudy: null, minor: null, recordComplete: false }
  const { data: row, error } = await supabase
    .from('user_profile')
    .select('year_of_study, minor, record_complete')
    .eq('user_id', uid)
    .maybeSingle()
  // The columns arrive with db/academic_profile.sql. Until it runs, this reads
  // as "not set yet" rather than breaking the page.
  if (error || !row) return { yearOfStudy: null, minor: null, recordComplete: false }
  const r = row as {
    year_of_study: number | null
    minor: string | null
    record_complete: boolean | null
  }
  return {
    yearOfStudy: r.year_of_study,
    minor: r.minor,
    recordComplete: r.record_complete ?? false,
  }
}
