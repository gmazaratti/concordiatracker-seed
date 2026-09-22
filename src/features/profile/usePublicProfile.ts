import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { warm } from '@/lib/img-cache'
import { cleanLinks, type ProfileLinks } from '@/lib/social'

export interface PublicProfile {
  /** Needed to tell whether this person owns an organisation — the organizer
   *  badge is derived from ownership rather than granted. */
  userId: string
  handle: string
  isPublic: boolean
  name?: string
  avatarUrl?: string
  program?: string
  programId?: string
  bio?: string
  /** Only what they typed, and only on a public profile. */
  links: ProfileLinks
  /** Whether the class list is shared at all — its own switch now, since
   *  "my profile exists" and "here is exactly what I am taking" are not the
   *  same disclosure. */
  coursesPublic: boolean
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
  user_id: string
  handle: string
  is_public: boolean
  name: string | null
  avatar_url: string | null
  program: string | null
  program_id: string | null
  bio: string | null
  links: unknown
  courses_public: boolean | null
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
  /** Re-read from the server — used after you edit your own profile, so the
   *  page you are looking at shows the change without a reload. */
  reload: () => void
}

type Loaded = Omit<PublicProfileState, 'reload'>

/**
 * What we already know about a profile, from this session.
 *
 * Messages → a profile → back → the same profile again is the single most
 * walked path in Community, and every leg of it used to throw the answer away
 * and show a spinner for the round trip. Keyed by the handle you asked for —
 * lower-cased, so `/@Alex` and `/@alex` share one entry, and an alias like
 * `ceo` caches under `ceo` while the row inside it is Alex's.
 *
 * STALE-WHILE-REVALIDATE, not a TTL. A cached profile paints instantly and the
 * request goes out anyway; when it lands the page updates in place. So the
 * data is never older than one navigation, and nobody ever waits to look at
 * something they were looking at ten seconds ago. There is no eviction — a
 * session would have to open hundreds of profiles for the map to be worth
 * anything, and a reload empties it.
 */
const cache = new Map<string, Loaded>()

/** Dropped when you edit yourself, so Save is not followed by the old bio. */
export function forgetProfile(handle: string): void {
  cache.delete(handle.trim().toLowerCase())
}

/**
 * Loads a user's PUBLIC profile by handle via the SECURITY DEFINER RPCs — the
 * only path that can read another user's data, and only when they're public.
 * A private profile resolves with `isPublic: false` and no courses/blueprints
 * (the server returns nothing else). Works for signed-out visitors (anon).
 */
export function usePublicProfile(handle: string): PublicProfileState {
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => {
    forgetProfile(handle)
    setTick((n) => n + 1)
  }, [handle])
  const key = handle.trim().toLowerCase()
  const [state, setState] = useState<Loaded>(
    () =>
      cache.get(key) ?? {
        loading: true,
        notFound: false,
        profile: null,
        courses: [],
        blueprints: [],
      },
  )

  useEffect(() => {
    let active = true
    const put = (next: Loaded) => {
      cache.set(key, next)
      if (active) setState(next)
    }
    void (async () => {
      const { data } = await supabase.rpc('get_public_profile', { p_handle: handle })
      if (!active) return
      const row = (data as ProfileRpcRow[] | null)?.[0]
      if (!row) {
        put({ loading: false, notFound: true, profile: null, courses: [], blueprints: [] })
        return
      }
      const profile: PublicProfile = {
        userId: row.user_id,
        handle: row.handle,
        isPublic: row.is_public,
        name: row.name ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
        program: row.program ?? undefined,
        programId: row.program_id ?? undefined,
        bio: row.bio ?? undefined,
        links: cleanLinks(row.links),
        coursesPublic: row.courses_public === true,
      }
      // The face is the one thing on this page that must never blink.
      warm([profile.avatarUrl], 1)
      if (!row.is_public) {
        put({ loading: false, notFound: false, profile, courses: [], blueprints: [] })
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
      put({ loading: false, notFound: false, profile, courses, blueprints })
    })()
    return () => {
      active = false
    }
  }, [handle, key, tick])

  return { ...state, reload }
}
