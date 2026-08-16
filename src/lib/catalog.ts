import { supabase } from '@/lib/supabase'

/**
 * The course directory, read from the Supabase mirror rather than Concordia.
 * See db/course_catalog.sql: the catalogue is 1.4MB in one response, so it is
 * synced on a schedule and searched locally.
 */

export interface CatalogCourse {
  id: string
  subject: string
  catalog: string
  title: string
  career: string | null
  class_unit: number | null
  prerequisites: string | null
  /** Concordia's own course description. Null until the sync has run with
   *  db/course_descriptions.sql applied. */
  description?: string | null
}

export async function searchCourses(q: string, limit = 40): Promise<CatalogCourse[]> {
  if (!q.trim()) return []
  const { data, error } = await supabase.rpc('search_courses', { p_q: q, p_limit: limit })
  if (error) throw error
  return (data ?? []) as CatalogCourse[]
}

/**
 * A catalogue course plus what the app knows about it: whether an outline
 * already exists, and how many students track it.
 */
export interface EnrichedCourse extends CatalogCourse {
  blueprint_count: number
  has_verified: boolean
  tracked_by: number
}

/**
 * Search the whole calendar, annotated.
 *
 * The add-course picker uses this instead of the blueprint list so a student
 * can pick ANY course Concordia offers. Courses that already have an outline
 * are marked, because those are the ones where picking saves real work.
 */
export async function searchCoursesEnriched(q: string, limit = 40): Promise<EnrichedCourse[]> {
  if (!q.trim()) return []
  const { data, error } = await supabase.rpc('search_courses_enriched', {
    p_q: q,
    p_limit: limit,
  })
  // Deploy order must not matter. If the annotation migration has not run yet,
  // fall back to the plain catalogue search: the student still picks a real
  // course with a real code, they just do not see which ones have an outline.
  // Losing a badge is a degraded feature; a search box that returns nothing
  // looks like the product is broken.
  if (error) {
    const rows = await searchCourses(q, limit)
    return rows.map((r) => ({ ...r, blueprint_count: 0, has_verified: false, tracked_by: 0 }))
  }
  return (data ?? []) as EnrichedCourse[]
}

/**
 * Below this, a tracking count reads as "nobody uses this" rather than as
 * social proof, so no count is shown at all. It also keeps an aggregate over a
 * handful of people from being a signal about any one of them.
 */
export const TRACKED_MIN = 3

/** Aggregate interest in a course code. Never returns identities. */
export async function courseTracking(code: string): Promise<{ tracked_by: number; watching: number }> {
  const { data, error } = await supabase.rpc('course_tracking', { p_code: code })
  if (error) return { tracked_by: 0, watching: 0 }
  const row = (Array.isArray(data) ? data[0] : data) as { tracked_by: number; watching: number }
  return row ?? { tracked_by: 0, watching: 0 }
}

/** A page of the catalogue, with the total so a Load more button knows when to
 *  stop. Null or empty subjects means the whole calendar. */
export async function browseCourses(opts: {
  subjects?: string[] | null
  offset?: number
  limit?: number
}): Promise<{ rows: CatalogCourse[]; total: number }> {
  const { data, error } = await supabase.rpc('browse_courses', {
    p_subjects: opts.subjects ?? null,
    p_offset: opts.offset ?? 0,
    p_limit: opts.limit ?? 10,
  })
  if (error) return { rows: [], total: 0 }
  const rows = (data ?? []) as (CatalogCourse & { total_count: number | string })[]
  return { rows, total: rows.length ? Number(rows[0].total_count) : 0 }
}

/** The subject codes the student has actually studied, most-used first. */
export async function mySubjects(): Promise<string[]> {
  const { data, error } = await supabase.rpc('my_subjects')
  if (error) return []
  return ((data ?? []) as { subject: string }[]).map((r) => r.subject)
}

export async function catalogStatus(): Promise<{ total: number; synced_at: string | null }> {
  const { data, error } = await supabase.rpc('catalog_status')
  if (error) return { total: 0, synced_at: null }
  const row = (Array.isArray(data) ? data[0] : data) as { total: number; synced_at: string | null }
  return row ?? { total: 0, synced_at: null }
}

/**
 * Course codes mentioned inside a prerequisite string.
 *
 * Concordia writes these as prose: "Pre-requisite: Previously or Co-currently:
 * MATH204". Pulling the codes out is enough to link them and to seed the
 * prerequisite tree later; parsing the LOGIC (and/or, "previously", "not taken")
 * is a separate problem and deliberately not attempted here, because a
 * half-understood rule shown as fact would be worse than showing the sentence.
 */
export function extractCourseCodes(prereq: string | null): string[] {
  if (!prereq) return []
  const found = prereq.match(/\b([A-Z]{4})\s?(\d{3}[A-Z]?)\b/g) ?? []
  return [...new Set(found.map((c) => c.replace(/\s+/g, ' ').trim()))]
}

/**
 * Catalogue rows for a set of codes, in one round trip.
 *
 * Feeds the prerequisite tree, which fetches a whole LEVEL at a time: a chain
 * four deep with three branches each is forty requests one course at a time and
 * four this way.
 */
export async function coursesByCodes(codes: string[]): Promise<CatalogCourse[]> {
  if (codes.length === 0) return []
  const { data, error } = await supabase.rpc('courses_by_codes', { p_codes: codes })
  if (error) return []
  return (data ?? []) as CatalogCourse[]
}

/** Courses that name this one in their prerequisites: what finishing it opens. */
export async function unlockedBy(code: string, limit = 60): Promise<CatalogCourse[]> {
  const { data, error } = await supabase.rpc('unlocked_by', { p_code: code, p_limit: limit })
  if (error) return []
  return (data ?? []) as CatalogCourse[]
}
