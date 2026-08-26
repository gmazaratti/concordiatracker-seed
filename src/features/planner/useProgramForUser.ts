import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadProgram } from '@/lib/programs'
import type { ProgramWithGroups } from '@/lib/program-progress'

/**
 * The signed-in student's programme, majors included.
 *
 * `major_id` wins over `program_id` when both are set, because a major already
 * inherits its degree's groups — loading the degree instead would silently drop
 * the 24 credits the student most wants to see.
 *
 * Returns null while loading and null when there is no programme on file, and
 * those are deliberately the same to the caller: neither is a state anything
 * should render a requirement against.
 */
export function useProgramForUser(): ProgramWithGroups | null {
  const [program, setProgram] = useState<ProgramWithGroups | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data } = await supabase
        .from('user_profile')
        .select('program_id, major_id')
        .eq('user_id', auth.user.id)
        .maybeSingle()
      const id = (data as { program_id?: string; major_id?: string } | null)?.major_id ??
        (data as { program_id?: string } | null)?.program_id
      if (!id || !alive) return
      const loaded = await loadProgram(id)
      if (alive) setProgram(loaded)
    })()
    return () => {
      alive = false
    }
  }, [])

  return program
}
