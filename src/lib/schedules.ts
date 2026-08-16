import { supabase } from '@/lib/supabase'
import type { SectionOption } from '@/lib/seats'

/**
 * Saved schedules: several drafts of a term, and a link to show someone.
 *
 * Sections are stored as a snapshot rather than as references into the
 * catalogue. A schedule is a record of a decision, and it should still open next
 * year after the section has been renumbered and the seat counts have moved on.
 */

/**
 * Where you actually stand with a section.
 *
 * A schedule with five classes on it means nothing without this: two enrolled,
 * one waitlisted and two you have not touched is a completely different
 * situation from five confirmed, and the grid looks identical either way.
 */
export type EnrollmentState = 'planned' | 'cart' | 'waitlisted' | 'enrolled'

export const ENROLLMENT_STATES: { value: EnrollmentState; label: string; dot: string }[] = [
  { value: 'planned', label: 'Planned', dot: 'bg-subtle' },
  { value: 'cart', label: 'In course cart', dot: 'bg-info' },
  { value: 'waitlisted', label: 'Waitlisted', dot: 'bg-warning' },
  { value: 'enrolled', label: 'Enrolled', dot: 'bg-success' },
]

/** A section as it was when it was chosen, plus the course it belongs to. */
export interface PickedSection {
  code: string
  section: SectionOption
  /** Absent on schedules saved before this existed, which read as "planned". */
  state?: EnrollmentState
}

/** A time the student is not available. */
export interface TimeBlock {
  id: string
  /** 0 = Sunday, matching Date.getDay(). */
  day: number
  /** "09:00" */
  start: string
  end: string
  label: string
}

export interface SavedSchedule {
  id: string
  name: string
  term_code: string | null
  sections: PickedSection[]
  blocks: TimeBlock[]
  share_token: string | null
  updated_at: string
}

export async function listSchedules(): Promise<SavedSchedule[]> {
  const { data, error } = await supabase
    .from('saved_schedules')
    .select('id, name, term_code, sections, blocks, share_token, updated_at')
    .order('updated_at', { ascending: false })
  if (error) return []
  return (data ?? []) as SavedSchedule[]
}

export async function createSchedule(input: {
  name: string
  termCode: string | null
  sections: PickedSection[]
  blocks: TimeBlock[]
}): Promise<string | null> {
  const { data } = await supabase
    .from('saved_schedules')
    .insert({
      name: input.name,
      term_code: input.termCode,
      sections: input.sections,
      blocks: input.blocks,
    })
    .select('id')
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function updateSchedule(
  id: string,
  patch: { name?: string; termCode?: string | null; sections?: PickedSection[]; blocks?: TimeBlock[] },
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) row.name = patch.name
  if (patch.termCode !== undefined) row.term_code = patch.termCode
  if (patch.sections !== undefined) row.sections = patch.sections
  if (patch.blocks !== undefined) row.blocks = patch.blocks
  await supabase.from('saved_schedules').update(row).eq('id', id)
}

export async function deleteSchedule(id: string): Promise<void> {
  await supabase.from('saved_schedules').delete().eq('id', id)
}

/** Mint (or re-read) the share token. Stable, so a link already sent keeps working. */
export async function shareSchedule(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('share_schedule', { p_id: id })
  if (error) return null
  return typeof data === 'string' ? data : null
}

export async function unshareSchedule(id: string): Promise<void> {
  await supabase.rpc('unshare_schedule', { p_id: id })
}

export interface SharedSchedule {
  name: string
  term_code: string | null
  sections: PickedSection[]
  blocks: TimeBlock[]
  created_at: string
}

/** Open a shared schedule. Works signed out; never reveals whose it is. */
export async function scheduleByToken(token: string): Promise<SharedSchedule | null> {
  const { data, error } = await supabase.rpc('schedule_by_token', { p_token: token })
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as SharedSchedule | undefined
  return row ?? null
}
