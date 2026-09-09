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

/**
 * Which programme the student picked, and remembering it.
 *
 * Stored in `user_profile.major_id`, NOT `program_id` — those are two different
 * registries that happen to share a word. `program_id` holds the onboarding
 * picker's canonical id (`computer-science-bcompsc`, from `data/programs.ts`),
 * which is a display and category value; this one holds an id from the curated
 * `programs` REQUIREMENTS table (`bcompsc`, `bcomm-finance`). Writing one over
 * the other would silently destroy the other feature's answer, and `major_id`
 * already exists for exactly this: a degree or the major on top of it.
 *
 * Both failures are swallowed on purpose. The picker has to keep working in the
 * session even if the column is missing because a migration has not been run —
 * losing the choice on reload is a nuisance, being unable to choose at all is a
 * dead page.
 */
export async function loadProgramChoice(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data } = await supabase
    .from('user_profile')
    .select('major_id, program_id')
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const row = data as { major_id?: string | null; program_id?: string | null } | null
  if (row?.major_id) return row.major_id
  // Nothing chosen here yet, so fall back to what onboarding already asked:
  // someone who said "Finance (BComm)" on their second screen should not be
  // asked again on a page whose whole job is to know that.
  return row?.program_id ? (FROM_ONBOARDING[row.program_id] ?? null) : null
}

/**
 * Onboarding's registry id -> the curated requirements id.
 *
 * Two lists, made at different times for different jobs: onboarding covers all
 * 162 programmes for display and filtering, this one covers the handful whose
 * requirements have been transcribed. The map is only as long as the overlap,
 * and an id with no entry simply means "we have no requirements for that yet",
 * which is the honest answer rather than a wrong programme.
 */
const FROM_ONBOARDING: Record<string, string> = {
  'computer-science-bcompsc': 'bcompsc',
  'accountancy-bcomm': 'bcomm-accountancy',
  'business-technology-management-bcomm': 'bcomm-btm',
  'economics-bcomm': 'bcomm-economics',
  'finance-bcomm': 'bcomm-finance',
  'human-resource-management-bcomm': 'bcomm-hrm',
  'international-business-bcomm': 'bcomm-international-business',
  'management-bcomm': 'bcomm-management',
  'marketing-bcomm': 'bcomm-marketing',
  'supply-chain-operations-management-bcomm': 'bcomm-scom',
}

/** True when it actually persisted, so the UI can say so when it did not. */
export async function saveProgramChoice(id: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return false
  const { error } = await supabase
    .from('user_profile')
    .update({ major_id: id })
    .eq('user_id', auth.user.id)
  return !error
}

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

