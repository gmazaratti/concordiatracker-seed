import { supabase } from '@/lib/supabase'

/**
 * Seat watching — client wrappers over db/seat_watch.sql, plus the section
 * lookup that goes through /api/sections so the Concordia key stays server-side.
 */

export interface SectionOption {
  classNumber: string
  termCode: string
  section: string
  courseTitle: string
  component: string
  componentLabel: string
  meetingTimes: string | null
  enrolled: number | null
  capacity: number | null
  waitlisted: number | null
  waitlistCap: number | null
  hasReserved: boolean
  location: string
  instructionMode: string
  building: string
  room: string
}

export interface SeatWatch {
  id: string
  class_number: string
  term_code: string
  subject: string
  catalog: string
  section: string
  course_title: string | null
  last_enrollment: number | null
  last_capacity: number | null
  last_waitlist_total: number | null
  last_waitlist_cap: number | null
  has_reserved: boolean
  checked_at: string | null
  notified_at: string | null
}

/** Every section of a course, newest term first. */
export async function findSections(subject: string, catalog: string): Promise<SectionOption[]> {
  const res = await fetch(
    `/api/sections?subject=${encodeURIComponent(subject)}&catalog=${encodeURIComponent(catalog)}`,
  )
  const body = (await res.json()) as { sections?: SectionOption[]; error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Could not look that course up.')
  return body.sections ?? []
}

export async function myWatches(): Promise<SeatWatch[]> {
  const { data, error } = await supabase.rpc('my_seat_watches')
  if (error) throw error
  return (data ?? []) as SeatWatch[]
}

/** The server enforces the plan limit, so a rejection here is authoritative. */
export async function addWatch(s: SectionOption, subject: string, catalog: string): Promise<void> {
  const { error } = await supabase.rpc('add_seat_watch', {
    p_class_number: s.classNumber,
    p_term_code: s.termCode,
    p_subject: subject,
    p_catalog: catalog,
    p_section: `${s.section} ${s.component}`.trim(),
    p_course_title: s.courseTitle,
  })
  if (error) throw error
}

export async function removeWatch(id: string): Promise<void> {
  const { error } = await supabase.from('seat_watches').delete().eq('id', id)
  if (error) throw error
}

export async function watchLimit(): Promise<number> {
  const { data, error } = await supabase.rpc('seat_watch_limit')
  if (error) return 1
  return typeof data === 'number' ? data : 1
}

/** Seats free right now, or null when we haven't polled the section yet. */
export function seatsOpen(w: SeatWatch): number | null {
  if (w.last_capacity === null || w.last_enrollment === null) return null
  return Math.max(0, w.last_capacity - w.last_enrollment)
}

/**
 * Concordia's term codes are 4 digits: century-ish prefix, year, then a term
 * digit — 2244 is Winter 2025. Decoded loosely on purpose; an unrecognised
 * shape returns the raw code rather than a confidently wrong term name.
 */
export function termLabel(code: string): string {
  if (!/^\d{4}$/.test(code)) return code
  const year = 2000 + Number(code.slice(1, 3))
  const season = { '1': 'Summer', '2': 'Fall', '4': 'Winter' }[code[3]]
  if (!season) return code
  // A Winter term belongs to the academic year that started the previous autumn.
  return `${season} ${season === 'Winter' ? year + 1 : year}`
}
