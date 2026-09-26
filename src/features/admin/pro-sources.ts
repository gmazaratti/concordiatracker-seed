import { supabase } from '@/lib/supabase'

/** Why an account has Pro (db/team_pro.sql, admin_pro_sources). */
export interface ProSource {
  user_id?: string
  paid: boolean
  manual: boolean
  team_clubs: string[]
}

/** Short labels, in the order they win: paid, team, manual. Empty = Free. */
export function proSourceLabels(pro: ProSource | null | undefined): string[] {
  if (!pro) return []
  const out: string[] = []
  if (pro.paid) out.push('Paid')
  if (pro.team_clubs?.length) out.push(`Team: ${pro.team_clubs.join(', ')}`)
  if (pro.manual) out.push('Manual grant')
  return out
}

/** Every Pro account and its sources, keyed by user id. */
export async function loadProSources(): Promise<Map<string, ProSource>> {
  const { data, error } = await supabase.rpc('admin_pro_sources')
  if (error) throw new Error(error.message)
  return new Map(((data ?? []) as ProSource[]).map((r) => [r.user_id as string, r]))
}
