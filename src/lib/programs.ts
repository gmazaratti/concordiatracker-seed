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

/**
 * A programme and everything it requires.
 *
 * A MAJOR inherits its degree's groups: "Commerce — Finance" is the BComm core
 * plus the Finance groups, and the core is stored once so it cannot drift
 * between the majors that share it. Positions keep the order right — a degree's
 * groups occupy 1-6 and a major's start at 10 — so the student sees the things
 * everyone does before the things their major adds.
 */
export async function loadProgram(id: string): Promise<ProgramWithGroups | null> {
  const { data: prog } = await supabase.from('programs').select('*').eq('id', id).maybeSingle()
  if (!prog) return null
  const program = prog as Program

  const ids = program.parent_id ? [program.parent_id, program.id] : [program.id]
  const { data: groups } = await supabase
    .from('program_groups')
    .select('*')
    .in('program_id', ids)
    .order('position')

  const all = (groups ?? []) as RequirementGroup[]
  // Ordered by position across BOTH programmes, since `.order` only sorts
  // within what the query returned and the two sets interleave by design.
  all.sort((a, b) => a.position - b.position)
  return { ...program, groups: all }
}

