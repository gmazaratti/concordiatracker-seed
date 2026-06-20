import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface PublicProfile {
  handle: string
  isPublic: boolean
  name?: string
  avatarUrl?: string
  program?: string
  programId?: string
  bio?: string
}

export interface PublicCourse {
  code: string
  title: string
  color: string
  term: string
}

export interface PublicBlueprint {
  id: string
  courseCode: string
  courseName: string
  section: string
  term: string
  verified: boolean
  net: number
  imports: number
  itemCount: number
}

interface ProfileRpcRow {
  handle: string
  is_public: boolean
  name: string | null
  avatar_url: string | null
  program: string | null
  program_id: string | null
  bio: string | null
}
interface CourseRpcRow { code: string; title: string; color: string; term: string }
interface BlueprintRpcRow {
  id: string
  course_code: string
  course_name: string
  section: string
  term: string
  verified: boolean
  upvotes: number
  downvotes: number
  imports: number
  item_count: number
}

export interface PublicProfileState {
  loading: boolean
  notFound: boolean
  profile: PublicProfile | null
  courses: PublicCourse[]
  blueprints: PublicBlueprint[]
}

/**
 * Loads a user's PUBLIC profile by handle via the SECURITY DEFINER RPCs — the
 * only path that can read another user's data, and only when they're public.
 * A private profile resolves with `isPublic: false` and no courses/blueprints
 * (the server returns nothing else). Works for signed-out visitors (anon).
 */
export function usePublicProfile(handle: string): PublicProfileState {
  const [state, setState] = useState<PublicProfileState>({
    loading: true,
    notFound: false,
    profile: null,
    courses: [],
    blueprints: [],
  })

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('get_public_profile', { p_handle: handle })
      if (!active) return
      const row = (data as ProfileRpcRow[] | null)?.[0]
      if (!row) {
        setState({ loading: false, notFound: true, profile: null, courses: [], blueprints: [] })
        return
      }
      const profile: PublicProfile = {
        handle: row.handle,
        isPublic: row.is_public,
        name: row.name ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
        program: row.program ?? undefined,
        programId: row.program_id ?? undefined,
        bio: row.bio ?? undefined,
      }
      if (!row.is_public) {
        setState({ loading: false, notFound: false, profile, courses: [], blueprints: [] })
        return
      }
      const [courseRes, bpRes] = await Promise.all([
        supabase.rpc('get_public_courses', { p_handle: handle }),
        supabase.rpc('get_public_blueprints', { p_handle: handle }),
      ])
      if (!active) return
      const courses = ((courseRes.data as CourseRpcRow[] | null) ?? []).map((c) => ({
        code: c.code,
        title: c.title,
        color: c.color,
        term: c.term,
      }))
      const blueprints = ((bpRes.data as BlueprintRpcRow[] | null) ?? []).map((b) => ({
        id: b.id,
        courseCode: b.course_code,
        courseName: b.course_name,
        section: b.section,
        term: b.term,
        verified: b.verified,
        net: (b.upvotes ?? 0) - (b.downvotes ?? 0),
        imports: b.imports ?? 0,
        itemCount: b.item_count ?? 0,
      }))
      setState({ loading: false, notFound: false, profile, courses, blueprints })
    })()
    return () => {
      active = false
    }
  }, [handle])

  return state
}
