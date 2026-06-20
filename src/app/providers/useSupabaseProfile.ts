import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth'
import { supabase, fireWrite } from '@/lib/supabase'
import { OTHER_PROGRAM_ID } from '@/data/programs'
import type { Plan, User } from '@/data/types'

/** The columns of `user_profile` the app actually uses. `program_id` is written
 * but deliberately NOT in COLS (the hot load path) so a missing column can't
 * break the app before the migration runs. */
interface ProfileRow {
  user_id: string
  name: string | null
  email: string | null
  school: string | null
  program: string | null
  program_id?: string | null
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

/** Append-only log of "Other" program entries for review. Fire-and-forget — a
 * missing table never blocks onboarding/settings. Only logs the 'other' case. */
function logProgramSuggestion(userId: string, programId?: string, text?: string) {
  if (programId === OTHER_PROGRAM_ID && text?.trim()) {
    fireWrite(supabase.from('program_suggestions').insert({ user_id: userId, text: text.trim() }))
  }
}

/**
 * Phase 2: the signed-in user's real profile + plan, backed by `user_profile`.
 * Fetches (or creates, on first sign-in) the row for the auth user, and persists
 * Settings edits. Replaces the mock `user`/`plan` in `AppDataProvider` — every
 * component that reads `useAppData().user`/`.plan` now sees real data.
 */
export function useSupabaseProfile() {
  const { user: authUser } = useAuth()
  const [row, setRow] = useState<ProfileRow | null>(null)
  // Debounce profile writes so per-keystroke edits don't spam the database.
  const pendingRef = useRef<Partial<ProfileRow>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load (or create, on first sign-in) the profile row. Keyed on the user *id*
  // — NOT the authUser object — so it runs exactly once per sign-in, not again
  // on every token refresh / auth-state event (each of which rebuilds authUser).
  // That stability is what makes first sign-in reliable: a new user's row is
  // created AND loaded in one pass, so the onboarding gate sees
  // `onboarding_completed: false` instead of hanging forever on `null`.
  useEffect(() => {
    if (!authUser) return
    const au = authUser
    let active = true
    void (async () => {
      const meta = au.user_metadata as Record<string, unknown> | undefined
      const av = metaAvatar(meta)
      // 1. Try to load the existing row.
      let { data } = await supabase.from('user_profile').select(COLS).eq('user_id', au.id).maybeSingle()
      // 2. First sign-in → create it. Upsert is idempotent on user_id, so it's
      //    safe even if this runs twice (StrictMode / a racing tab).
      if (!data) {
        const name =
          (meta?.full_name as string) || (meta?.name as string) || au.email?.split('@')[0] || 'Student'
        // Carry a captured vanity referral code onto the new profile (signup
        // attribution) — only on creation, so it never overwrites an existing one.
        let ref: string | null
        try {
          ref = localStorage.getItem('ct_ref')
        } catch {
          ref = null
        }
        const ins = await supabase
          .from('user_profile')
          .upsert(
            {
              user_id: au.id,
              email: au.email ?? '',
              name,
              ...(av ? { avatar_url: av } : {}),
              ...(ref ? { referred_by_code: ref } : {}),
            },
            { onConflict: 'user_id' },
          )
          .select(COLS)
          .maybeSingle()
        data = ins.data
        // If the upsert returned nothing (a concurrent run created the row),
        // read it back — so we NEVER end up with no row → no infinite spinner.
        if (!data) {
          const reload = await supabase.from('user_profile').select(COLS).eq('user_id', au.id).maybeSingle()
          data = reload.data
        }
      }
      if (!active || !data) return
      const loaded = data as ProfileRow
      // Keep the Google avatar fresh so the feedback feed's denormalized
      // author_avatar can read it.
      const changed = av && av !== loaded.avatar_url
      setRow(changed ? { ...loaded, avatar_url: av } : loaded)
      if (changed) {
        fireWrite(supabase.from('user_profile').update({ avatar_url: av }).eq('user_id', au.id))
      }
    })()
    return () => {
      active = false
    }
    // Intentionally keyed on the user id only; authUser is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id])

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
   * on both Finish (full data) and Skip (whatever was collected). `program` is
   * the display name; `programId` is the canonical id (or 'other'). */
  const completeOnboarding = useCallback(
    async (
      data: { name?: string; handle?: string; programId?: string; program?: string },
    ): Promise<{ error: 'handle-taken' | 'save-failed' | null }> => {
      if (!authUser) return { error: null }
      const patch: Partial<ProfileRow> = { onboarding_completed: true }
      if (data.name) patch.name = data.name
      if (data.handle) patch.handle = data.handle
      if (data.program) patch.program = data.program
      if (data.programId) patch.program_id = data.programId
      // Write FIRST, then reflect locally — so a rejected handle (unique
      // violation) never leaves the app thinking onboarding succeeded.
      let { error } = await supabase.from('user_profile').update(patch).eq('user_id', authUser.id)
      // program_id column may not be migrated yet → retry without it.
      if (error?.code === '42703' && patch.program_id !== undefined) {
        const rest = { ...patch }
        delete rest.program_id
        ;({ error } = await supabase.from('user_profile').update(rest).eq('user_id', authUser.id))
      }
      if (error) {
        // 23505 = unique_violation; handle is the only unique field on this row.
        return { error: error.code === '23505' ? 'handle-taken' : 'save-failed' }
      }
      setRow((r) => (r ? { ...r, ...patch } : r))
      logProgramSuggestion(authUser.id, data.programId, data.program)
      return { error: null }
    },
    [authUser],
  )

  /** Set the program from Settings: writes the display name + canonical id, and
   * logs an "Other" entry for review. Optimistic; deploy-safe (retries without
   * program_id if the column is absent). */
  const setProgram = useCallback(
    (sel: { id: string; name: string }) => {
      if (!authUser) return
      setRow((r) => (r ? { ...r, program: sel.name, program_id: sel.id } : r))
      void (async () => {
        const { error } = await supabase
          .from('user_profile')
          .update({ program: sel.name, program_id: sel.id })
          .eq('user_id', authUser.id)
        if (error?.code === '42703') {
          fireWrite(supabase.from('user_profile').update({ program: sel.name }).eq('user_id', authUser.id))
        }
      })()
      logProgramSuggestion(authUser.id, sel.id, sel.name)
    },
    [authUser],
  )

  /** Change the @handle (Settings). Updates only `handle`; the DB trigger stamps
   * `handle_changed_at` and enforces the 14-day cooldown — so this is deploy-safe
   * even before the migration (handle just changes, unthrottled, until then). */
  const changeHandle = useCallback(
    async (next: string): Promise<{ error: 'taken' | 'cooldown' | 'invalid' | 'save-failed' | null }> => {
      if (!authUser) return { error: null }
      const handle = next.trim().toLowerCase()
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) return { error: 'invalid' }
      if (handle === (row?.handle ?? '')) return { error: null } // no-op
      const { error } = await supabase.from('user_profile').update({ handle }).eq('user_id', authUser.id)
      if (error) {
        if (error.code === '23505') return { error: 'taken' }
        if (error.code === '23514') return { error: 'cooldown' } // trigger's check_violation
        return { error: 'save-failed' }
      }
      setRow((r) => (r ? { ...r, handle } : r))
      return { error: null }
    },
    [authUser, row?.handle],
  )

  return {
    user,
    plan: user.plan,
    setPlan,
    updateProfile,
    setProgram,
    onboardingCompleted,
    completeOnboarding,
    changeHandle,
  }
}
