import { supabase } from './supabase'
import type { Program, ProgramWithGroups, RequirementGroup } from './program-progress'

export type {
  Program,
  ProgramWithGroups,
  RequirementCourse,
  RequirementGroup,
} from './program-progress'

/** Reading the curated requirement tables. The arithmetic over them is pure and
 *  lives in `program-progress.ts`, so it can be checked without a network. */

export async function listPrograms(): Promise<Program[]> {
  const { data, error } = await supabase.from('programs').select('*').order('name')
  if (error) throw error
  return (data ?? []) as Program[]
}

export async function loadProgram(id: string): Promise<ProgramWithGroups | null> {
  const [{ data: prog }, { data: groups }] = await Promise.all([
    supabase.from('programs').select('*').eq('id', id).maybeSingle(),
    supabase.from('program_groups').select('*').eq('program_id', id).order('position'),
  ])
  if (!prog) return null
  return { ...(prog as Program), groups: (groups ?? []) as RequirementGroup[] }
}

