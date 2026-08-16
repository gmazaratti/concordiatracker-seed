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
}

export async function searchCourses(q: string, limit = 40): Promise<CatalogCourse[]> {
  if (!q.trim()) return []
  const { data, error } = await supabase.rpc('search_courses', { p_q: q, p_limit: limit })
  if (error) throw error
  return (data ?? []) as CatalogCourse[]
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
