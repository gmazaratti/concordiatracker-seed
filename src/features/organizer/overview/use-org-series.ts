import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { demoSeries, isDemoOrgId, type DaySeries } from '@/lib/demo-org'

export type { DaySeries }

/**
 * The club's days, for the Overview charts: the period asked for AND the one
 * before it, so every number can say whether it went up. The server caps a
 * request at 180 days, which is exactly two 90-day periods.
 *
 * Every count is a row that exists — a follow, a post, a like, a comment, a
 * published event. There is no view tracking for a real club, so nothing here
 * is an estimate (db/org_overview.sql).
 */
export function useOrgSeries(orgId: string | undefined, days: number) {
  const [rows, setRows] = useState<DaySeries[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!orgId) return
    let alive = true
    const span = Math.min(180, days * 2)
    const load: Promise<DaySeries[]> = isDemoOrgId(orgId)
      ? Promise.resolve(demoSeries(span))
      : Promise.resolve(supabase.rpc('org_daily_series', { p_org: orgId, p_days: span })).then(({ data, error }) => {
          if (error) throw new Error(error.message)
          type Row = { day: string; followers: number; new_followers: number; posts: number; likes: number; comments: number; events: number }
          return ((data ?? []) as Row[]).map((r) => ({
            day: r.day,
            followers: r.followers ?? 0,
            newFollowers: r.new_followers ?? 0,
            posts: r.posts ?? 0,
            likes: r.likes ?? 0,
            comments: r.comments ?? 0,
            events: r.events ?? 0,
          }))
        })
    void load
      .then((r) => {
        if (!alive) return
        setRows(r)
        setFailed(false)
      })
      .catch(() => {
        if (!alive) return
        setRows([])
        setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [orgId, days])

  const current = rows ? rows.slice(-days) : null
  const previous = rows ? rows.slice(0, Math.max(0, rows.length - days)) : null
  return { current, previous, failed }
}

export type SeriesKey = 'newFollowers' | 'likes' | 'comments' | 'posts' | 'events'

export const sum = (rows: DaySeries[] | null, k: SeriesKey) => (rows ?? []).reduce((n, r) => n + r[k], 0)

/** Change against the previous period, or null when there is nothing to
 *  compare with — "+∞%" from zero is not a number anybody can use. */
export function delta(now: number, before: number): number | null {
  if (before <= 0) return null
  return Math.round(((now - before) / before) * 100)
}
