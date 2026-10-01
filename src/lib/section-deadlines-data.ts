import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DeadlineRecord } from './section-deadlines'

/**
 * The registrar's deadline rows (db/section_deadlines.sql), loaded once per
 * session and shared by every screen that asks: the course page and the
 * calendar both read the same ~190 rows, a few kilobytes, so there is no point
 * filtering per course and paying for several round trips.
 *
 * A failed load leaves an empty list. Every consumer treats "no row" as
 * "say nothing", never as "no deadline", so the worst case is a missing card,
 * not a wrong date.
 */
let cache: DeadlineRecord[] | null = null
let inflight: Promise<DeadlineRecord[]> | null = null

const COLS =
  'term_code,kind,subject,catalog,section,session,section_prefixes,start_date,end_date,registration,dne,disc'

function load(): Promise<DeadlineRecord[]> {
  if (cache) return Promise.resolve(cache)
  inflight ??= Promise.resolve(supabase.from('section_deadlines').select(COLS).limit(2000))
    .then(({ data, error }) => {
      if (error) throw error
      cache = (data ?? []) as DeadlineRecord[]
      return cache
    })
    .catch(() => {
      inflight = null
      return [] as DeadlineRecord[]
    })
  return inflight
}

export function useDeadlineRows(): DeadlineRecord[] {
  const [rows, setRows] = useState<DeadlineRecord[]>(() => cache ?? [])
  useEffect(() => {
    if (cache) return
    let live = true
    load().then((r) => {
      if (live) setRows(r)
    })
    return () => {
      live = false
    }
  }, [])
  return rows
}
