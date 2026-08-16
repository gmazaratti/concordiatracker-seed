import { supabase } from '@/lib/supabase'

/**
 * The shortlist: courses you are considering, with your own notes.
 *
 * Private by construction. There is no read-others policy and no aggregate over
 * this table anywhere, because what someone is thinking of taking says more
 * about them than what they are taking, and nothing in the product needs it.
 */

export interface SavedCourse {
  id: string
  code: string
  title: string | null
  note: string | null
  planned_term: string | null
  created_at: string
}

export async function listSaved(): Promise<SavedCourse[]> {
  const { data, error } = await supabase
    .from('saved_courses')
    .select('id, code, title, note, planned_term, created_at')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as SavedCourse[]
}

/** Save a course. Saving one already on the list is a no-op, not an error. */
export async function saveCourse(code: string, title?: string | null): Promise<void> {
  await supabase.from('saved_courses').upsert(
    { code: code.trim(), title: title ?? null },
    { onConflict: 'user_id,code', ignoreDuplicates: true },
  )
}

export async function unsaveCourse(code: string): Promise<void> {
  await supabase.from('saved_courses').delete().eq('code', code.trim())
}

export async function updateSaved(
  id: string,
  patch: { note?: string | null; planned_term?: string | null },
): Promise<void> {
  await supabase.from('saved_courses').update(patch).eq('id', id)
}

/**
 * How much work a course is, from the outlines students have shared for it.
 *
 * Only ever derived from real blueprints. There is no workload score, no
 * estimate and no heuristic: a course with no outline shared shows nothing at
 * all, because a made-up difficulty number is exactly the sort of thing people
 * would choose their semester on.
 */
export interface Workload {
  code: string
  /** How many shared outlines this is averaged over. */
  outlines: number
  /** Mean number of graded items across those outlines. */
  assessments: number
  /** Mean weight carried by the single largest item, as a percentage. */
  heaviest: number
}

export async function workloadFor(codes: string[]): Promise<Map<string, Workload>> {
  const out = new Map<string, Workload>()
  if (codes.length === 0) return out
  const { data, error } = await supabase
    .from('shared_blueprints')
    .select('course_code, items')
    .in('course_code', codes)
  if (error || !data) return out

  const byCode = new Map<string, { counts: number[]; heaviest: number[] }>()
  for (const row of data as { course_code: string; items: unknown }[]) {
    const items = Array.isArray(row.items) ? (row.items as { weight?: number }[]) : []
    if (items.length === 0) continue
    const acc = byCode.get(row.course_code) ?? { counts: [], heaviest: [] }
    acc.counts.push(items.length)
    acc.heaviest.push(Math.max(...items.map((i) => Number(i.weight) || 0)))
    byCode.set(row.course_code, acc)
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  for (const [code, acc] of byCode) {
    out.set(code, {
      code,
      outlines: acc.counts.length,
      assessments: Math.round(mean(acc.counts) * 10) / 10,
      heaviest: Math.round(mean(acc.heaviest)),
    })
  }
  return out
}
