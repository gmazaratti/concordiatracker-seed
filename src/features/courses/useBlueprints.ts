import { useCallback, useEffect, useState } from 'react'
import { supabase, fireWrite } from '@/lib/supabase'
import {
  blueprintFromRow,
  blueprintToInsert,
  normalizeCode,
  type BlueprintRow,
} from '@/lib/supabase-adapters'
import { useAuth } from '@/app/providers/auth'
import { termRank } from '@/lib/term'
import type { Blueprint } from '@/data/blueprints'
import type { Assessment, Course } from '@/data/types'

/**
 * Phase 5 — the blueprint marketplace, backed by `shared_blueprints` +
 * `blueprint_votes`. Blueprints are SHARED content matched to a course by its
 * CODE ("COMP 248"), not by the per-user course id — so any student who adds a
 * course sees everyone's outlines for it. This is the swap point that replaced
 * the mock `BLUEPRINTS` array.
 */

const COLS =
  'id, user_id, course_code, course_name, professor, author, section, term, items, verified, upvotes, downvotes, imports, created_at'

type Dir = 1 | -1 | 0

export interface BlueprintCodeMatch {
  code: string
  courseName: string
  count: number
  hasVerified: boolean
  /** The most recent term any of this code's blueprints is for (for sorting). */
  term: string
}

/** Every course that has at least one shared outline — the browsable marketplace
 * (deduped by code). Light: ~one row per blueprint, grouped client-side. */
export function useAllBlueprintCourses() {
  const [list, setList] = useState<BlueprintCodeMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase
        .from('shared_blueprints')
        .select('course_code, course_name, verified, term')
      if (!active) return
      const byCode = new Map<string, BlueprintCodeMatch>()
      for (const row of (data as { course_code: string | null; course_name: string | null; verified: boolean | null; term: string | null }[]) ?? []) {
        const code = normalizeCode(row.course_code ?? '')
        if (!code) continue
        const e = byCode.get(code) ?? { code, courseName: '', count: 0, hasVerified: false, term: '' }
        e.count += 1
        if (row.verified) e.hasVerified = true
        if (!e.courseName && row.course_name) e.courseName = row.course_name
        // Keep the most recent term seen for this code.
        const t = row.term ?? ''
        if (t && (!e.term || termRank(t) > termRank(e.term))) e.term = t
        byCode.set(code, e)
      }
      setList([...byCode.values()].sort((a, b) => a.code.localeCompare(b.code)))
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  return { list, loading }
}

/** The full blueprint list for one course (by code) + the write actions:
 * persistent voting, import-count bump, and contribute. The browser remounts
 * this (key={course.id}) when the course changes, so `loading` resets naturally. */
export function useCourseBlueprints(course: Course) {
  const { user: authUser } = useAuth()
  const uid = authUser?.id
  const [blueprints, setBlueprints] = useState<Blueprint[]>([])
  const [votes, setVotes] = useState<Record<string, Dir>>({})
  const [loading, setLoading] = useState(true)
  const code = normalizeCode(course.code)

  const load = useCallback(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.from('shared_blueprints').select(COLS).eq('course_code', code)
      if (!active) return
      const list = (data as BlueprintRow[] | null)?.map(blueprintFromRow) ?? []
      setBlueprints(list)
      setLoading(false)
      // Re-apply this user's saved votes (so up/down survives a reload).
      if (uid && list.length) {
        const ids = list.map((b) => b.id)
        const { data: voteRows } = await supabase
          .from('blueprint_votes')
          .select('blueprint_id, vote_type')
          .eq('user_id', uid)
          .in('blueprint_id', ids)
        if (!active) return
        const map: Record<string, Dir> = {}
        for (const v of (voteRows as { blueprint_id: string; vote_type: string }[]) ?? []) {
          map[v.blueprint_id] = v.vote_type === 'up' ? 1 : -1
        }
        setVotes(map)
      }
    })()
    return () => {
      active = false
    }
  }, [code, uid])

  useEffect(() => load(), [load])

  /** Toggle a vote. The displayed net is the stored base + this delta, so we only
   * persist the user's own vote row (no counter RPCs) — no double counting, and
   * the vote survives a reload. */
  const castVote = useCallback(
    (id: string, dir: 1 | -1) => {
      setVotes((prev) => {
        const next: Dir = prev[id] === dir ? 0 : dir
        if (uid) {
          if (next === 0) {
            fireWrite(
              supabase.from('blueprint_votes').delete().eq('blueprint_id', id).eq('user_id', uid),
            )
          } else {
            fireWrite(
              supabase
                .from('blueprint_votes')
                .upsert(
                  { blueprint_id: id, user_id: uid, vote_type: next === 1 ? 'up' : 'down' },
                  { onConflict: 'blueprint_id,user_id' },
                ),
            )
          }
        }
        return { ...prev, [id]: next }
      })
    },
    [uid],
  )

  /** Bump the adoption counter when a blueprint is imported. */
  const recordImport = useCallback((id: string) => {
    setBlueprints((list) => list.map((b) => (b.id === id ? { ...b, imports: b.imports + 1 } : b)))
    fireWrite(supabase.rpc('increment_blueprint_imports', { p_id: id }))
  }, [])

  /** Share this course's outline as a new community blueprint, then reload. */
  const contribute = useCallback(
    async (assessments: Assessment[], author: string) => {
      if (!uid) return
      await supabase
        .from('shared_blueprints')
        .insert(blueprintToInsert({ userId: uid, course, author, assessments }))
      load()
    },
    [uid, course, load],
  )

  return { blueprints, votes, loading, castVote, recordImport, contribute, refresh: load }
}
