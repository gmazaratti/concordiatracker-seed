import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth'
import { supabase, fireWrite } from '@/lib/supabase'
import type { Plan, User } from '@/data/types'

/** The columns of `user_profile` the app actually uses. */
interface ProfileRow {
  user_id: string
  name: string | null
  email: string | null
  school: string | null
  program: string | null
  plan_status: string | null
  avatar_url: string | null
  handle: string | null
  onboarding_completed: boolean | null
}

const COLS =
  'user_id, name, email, school, program, plan_status, avatar_url, handle, onboarding_completed'

/** Google supplies the picture under either key, depending on the provider. */
const metaAvatar = (meta: Record<string, unknown> | undefined): string | null =>
  (meta?.avatar_url as string) || (meta?.picture as string) || null

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'

/** DB plan_status ('free'|'pro') ↔ the seed's Plan ('free'|'semester'). */
const toPlan = (status: string | null | undefined): Plan => (status === 'pro' ? 'semester' : 'free')

/**
 * Phase 2: the signed-in user's real profile + plan, backed by `user_profile`.
 * Fetches (or creates, on first sign-in) the row for the auth user, and persists
 * Settings edits. Replaces the mock `user`/`plan` in `AppDataProvider` — every
 * component that reads `useAppData().user`/`.plan` now sees real data.
 */
export function useSupabaseProfile() {
  const { user: authUser } = useAuth()
  const [row, setRow] = useState<ProfileRow | null>(null)
  // Guards against React StrictMode's double-effect creating two profile rows.
  const ensuredRef = useRef<Set<string>>(new Set())
  // Debounce profile writes so per-keystroke edits don't spam the database.
  const pendingRef = useRef<Partial<ProfileRow>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!authUser) return
    let active = true
    supabase
      .from('user_profile')
      .select(COLS)
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(async ({ data }) => {
        const meta = authUser.user_metadata as Record<string, unknown> | undefined
        const av = metaAvatar(meta)
        if (data) {
          const row = data as ProfileRow
          // Keep the Google avatar fresh on the profile so the feedback feed's
          // denormalized author_avatar can read it.
          const changed = av && av !== row.avatar_url
          if (active) setRow(changed ? { ...row, avatar_url: av } : row)
          if (changed) {
            fireWrite(supabase.from('user_profile').update({ avatar_url: av }).eq('user_id', authUser.id))
          }
          return
        }
        // No row yet → create one (first sign-in). Guard against a double-run.
        if (ensuredRef.current.has(authUser.id)) return
        ensuredRef.current.add(authUser.id)
        const name =
          (meta?.full_name as string) ||
          (meta?.name as string) ||
          authUser.email?.split('@')[0] ||
          'Student'
        // Carry a captured vanity referral code onto the new profile (signup
        // attribution) — only on creation, so it never overwrites an existing one.
        let ref: string | null
        try {
          ref = localStorage.getItem('ct_ref')
        } catch {
          ref = null
        }
        // Upsert (not insert) so a first-sign-in race can't violate the
        // user_id uniqueness constraint — it resolves to the existing row.
        const { data: created } = await supabase
          .from('user_profile')
          .upsert(
            {
              user_id: authUser.id,
              email: authUser.email ?? '',
              name,
              ...(av ? { avatar_url: av } : {}),
              ...(ref ? { referred_by_code: ref } : {}),
            },
            { onConflict: 'user_id' },
          )
          .select(COLS)
          .maybeSingle()
        if (active && created) setRow(created as ProfileRow)
      })
    return () => {
      active = false
    }
  }, [authUser])

  const updateProfile = useCallback(
    (patch: Partial<{ name: string; school: string; program: string }>) => {
      setRow((r) => (r ? { ...r, ...patch } : r)) // optimistic — UI updates live
      pendingRef.current = { ...pendingRef.current, ...patch }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const toWrite = pendingRef.current
        pendingRef.current = {}
        if (authUser && Object.keys(toWrite).length) {
          fireWrite(supabase.from('user_profile').update(toWrite).eq('user_id', authUser.id))
        }
      }, 400)
    },
    [authUser],
  )

  const setPlan = useCallback(
    (next: Plan) => {
      const plan_status = next === 'semester' ? 'pro' : 'free'
      setRow((r) => (r ? { ...r, plan_status } : r))
      if (authUser)
        fireWrite(supabase.from('user_profile').update({ plan_status }).eq('user_id', authUser.id))
    },
    [authUser],
  )

  // Only trust a row that belongs to the current user (avoids a flash of the
  // previous user's data after switching accounts). Memoized so `user` keeps a
  // stable identity between renders — otherwise it would re-render every consumer.
  const user = useMemo<User>(() => {
    const profile = row && row.user_id === authUser?.id ? row : null
    const meta = authUser?.user_metadata as Record<string, unknown> | undefined
    const name =
      profile?.name || (meta?.full_name as string) || authUser?.email?.split('@')[0] || 'Student'
    return {
      name,
      email: profile?.email || authUser?.email || '',
      initials: initialsOf(name),
      avatarUrl: profile?.avatar_url || metaAvatar(meta) || undefined,
      handle: profile?.handle ?? undefined,
      plan: toPlan(profile?.plan_status),
      school: profile?.school ?? '',
      program: profile?.program ?? '',
    }
  }, [row, authUser])

  // null = profile not loaded yet (so the gate waits instead of flashing the app).
  const onboardingCompleted = useMemo<boolean | null>(() => {
    if (!authUser) return null
    const profile = row && row.user_id === authUser.id ? row : null
    return profile ? !!profile.onboarding_completed : null
  }, [row, authUser])

  /** Save the onboarding profile + mark it complete (so it never re-shows). Used
   * on both Finish (full data) and Skip (whatever was collected). */
  const completeOnboarding = useCallback(
    async (data: { name?: string; handle?: string; major?: string }) => {
      const patch: Partial<ProfileRow> = { onboarding_completed: true }
      if (data.name) patch.name = data.name
      if (data.handle) patch.handle = data.handle
      if (data.major) patch.program = data.major
      setRow((r) => (r ? { ...r, ...patch } : r))
      if (authUser) {
        await supabase.from('user_profile').update(patch).eq('user_id', authUser.id)
      }
    },
    [authUser],
  )

  return { user, plan: user.plan, setPlan, updateProfile, onboardingCompleted, completeOnboarding }
}
