import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readRefSource } from '@/lib/ref-source'
import { signupAttribution } from '@/lib/attribution'
import { missingColumn } from '@/lib/pg-errors'
import { isNetworkError, readProfileRow, saveProfileRow } from '@/lib/offline-cache'
import { markOffline } from '@/lib/offline-state'
import { onOwnProfileChange } from '@/lib/profile-live'
import { useAuth } from './auth'
import { supabase, fireWrite } from '@/lib/supabase'
import { displayNameFrom } from '@/lib/oauth-identity'
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
  pro_until?: string | null
  /** On a club team (db/team_pro.sql): Pro while the membership lasts. */
  team_pro?: boolean | null
  avatar_url: string | null
  handle: string | null
  onboarding_completed: boolean | null
  profile_public?: boolean | null
  bio?: string | null
  at_concordia?: boolean | null
}

const COLS =
  'user_id, name, email, school, program, plan_status, pro_until, team_pro, avatar_url, handle, onboarding_completed'

/** Google supplies the picture under either key. Apple sends none at all, so
 *  this is null for Apple users and the initials avatar is used — which is the
 *  right answer, not a gap to fill with something invented. */
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

/** DB plan_status ('free'|'pro') ↔ the seed's Plan ('free'|'semester'). A live
 * `pro_until` window (e.g. the survey reward) also counts as Pro. */
const toPlan = (status: string | null | undefined, proUntil?: string | null, teamPro?: boolean | null): Plan => {
  if (status === 'pro') return 'semester'
  // Club teams get Pro for as long as they are on one (db/team_pro.sql). The
  // same three conditions as ct_is_pro(), so the app and the server agree.
  if (teamPro) return 'semester'
  if (proUntil && new Date(proUntil).getTime() > Date.now()) return 'semester'
  return 'free'
}

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
      // Known to be offline: the saved copy straight away (see below).
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const saved = readProfileRow<ProfileRow>(au.id)
        if (saved && active) setRow(saved)
        else markOffline(null)
        return
      }
      // 1. Try to load the existing row.
      const first = await supabase.from('user_profile').select(COLS).eq('user_id', au.id).maybeSingle()
      let data = first.data
      /*
       * A READ THAT FAILED IS NOT A MISSING ROW. Treating it as one sent the
       * app into step 2 below, an UPSERT, which on a flaky connection could
       * overwrite a real profile's name with the one from the sign-in
       * provider, and with no connection at all ended in an endless spinner.
       * A network failure uses this device's saved copy instead
       * (lib/offline-cache); any other error stops here rather than creating.
       */
      if (first.error) {
        if (isNetworkError(first.error)) {
          const saved = readProfileRow<ProfileRow>(au.id)
          if (saved && active) setRow(saved)
          else markOffline(null)
        }
        return
      }
      // 2. First sign-in → create it. Upsert is idempotent on user_id, so it's
      //    safe even if this runs twice (StrictMode / a racing tab).
      if (!data) {
        const name = displayNameFrom(meta, au.email)
        // Carry a captured vanity referral code onto the new profile (signup
        // attribution) — only on creation, so it never overwrites an existing one.
        let ref: string | null
        try {
          ref = localStorage.getItem('ct_ref')
        } catch {
          ref = null
        }
        const base = {
          user_id: au.id,
          email: au.email ?? '',
          name,
          ...(av ? { avatar_url: av } : {}),
          ...(ref ? { referred_by_code: ref } : {}),
          // The campaign link that brought them (/r = Reddit), set once at signup.
          ...(readRefSource() ? { signup_ref: readRefSource() } : {}),
        }
        // First-touch attribution (lib/attribution). If the columns are not
        // there yet the row is created without them: attribution is worth a
        // column, never a signup.
        let ins = await supabase
          .from('user_profile')
          .upsert({ ...base, ...signupAttribution(readRefSource(), ref) }, { onConflict: 'user_id' })
          .select(COLS)
          .maybeSingle()
        if (ins.error && (missingColumn(ins.error) || ins.error.code === '23514')) {
          ins = await supabase.from('user_profile').upsert(base, { onConflict: 'user_id' }).select(COLS).maybeSingle()
        }
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
      // author_avatar can read it. Only while the stored photo IS Google's (or
      // there is none): a photo the student uploaded must never be replaced by
      // their Google picture on the next sign-in.
      const ownsPhoto = !!loaded.avatar_url && !/googleusercontent\.com/.test(loaded.avatar_url)
      const changed = av && !ownsPhoto && av !== loaded.avatar_url
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

  // Keep this device's offline copy of the profile current.
  useEffect(() => {
    if (row && authUser && row.user_id === authUser.id) saveProfileRow(row.user_id, row)
  }, [row, authUser])

  const updateProfile = useCallback(
    (patch: Partial<{ name: string; school: string; program: string; avatar_url: string | null }>) => {
      setRow((r) => (r ? { ...r, ...patch } : r)) // optimistic: UI updates live
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

  // Live: an admin grant, a Stripe webhook or another tab changes this row, and
  // the app reflects it at once (plan, Pro-until, team Pro, name, picture). Only
  // the columns this hook already loads are merged; nothing polls.
  useEffect(() => {
    if (!authUser?.id) return
    const keys = COLS.split(',').map((k) => k.trim())
    return onOwnProfileChange(authUser.id, (fresh) => {
      const patch: Record<string, unknown> = {}
      for (const k of keys) if (k in fresh) patch[k] = fresh[k]
      setRow((r) => (r && r.user_id === authUser.id ? ({ ...r, ...patch } as ProfileRow) : r))
    })
  }, [authUser?.id])

  const setPlan = useCallback(
    (next: Plan) => {
      const plan_status = next === 'semester' ? 'pro' : 'free'
      setRow((r) => (r ? { ...r, plan_status } : r))
      // Through the admin RPC: plan columns are locked against direct writes
      // (db/profile_guard.sql), and only admins see this toggle anyway.
      if (authUser)
        fireWrite(
          supabase.rpc('admin_set_plan', {
            p_target: authUser.id,
            p_pro: plan_status === 'pro',
            p_reason: 'Demo plan toggle',
            p_until: null,
          }),
          'The demo plan did not change',
        )
    },
    [authUser],
  )

  // Only trust a row that belongs to the current user (avoids a flash of the
  // previous user's data after switching accounts). Memoized so `user` keeps a
  // stable identity between renders — otherwise it would re-render every consumer.
  const user = useMemo<User>(() => {
    const profile = row && row.user_id === authUser?.id ? row : null
    const meta = authUser?.user_metadata as Record<string, unknown> | undefined
    const name = profile?.name || displayNameFrom(meta, authUser?.email)
    return {
      name,
      email: profile?.email || authUser?.email || '',
      initials: initialsOf(name),
      avatarUrl: profile?.avatar_url || metaAvatar(meta) || undefined,
      handle: profile?.handle ?? undefined,
      plan: toPlan(profile?.plan_status, profile?.pro_until, profile?.team_pro),
      school: profile?.school ?? '',
      program: profile?.program ?? '',
      // Absent column (migration pending) reads as true, which is the default
      // the column itself carries — so a pending migration changes nothing.
      atConcordia: profile?.at_concordia !== false,
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
      data: {
        name?: string
        handle?: string
        programId?: string
        program?: string
        profilePublic?: boolean
        school?: string
        atConcordia?: boolean
      },
    ): Promise<{ error: 'handle-taken' | 'save-failed' | null }> => {
      if (!authUser) return { error: null }
      const patch: Partial<ProfileRow> = { onboarding_completed: true }
      if (data.name) patch.name = data.name
      if (data.handle) patch.handle = data.handle
      if (data.program) patch.program = data.program
      if (data.programId) patch.program_id = data.programId
      if (data.profilePublic !== undefined) patch.profile_public = data.profilePublic
      if (data.school !== undefined) patch.school = data.school
      if (data.atConcordia !== undefined) patch.at_concordia = data.atConcordia
      // Write FIRST, then reflect locally — so a rejected handle (unique
      // violation) never leaves the app thinking onboarding succeeded.
      let { error } = await supabase.from('user_profile').update(patch).eq('user_id', authUser.id)
      // program_id / profile_public columns may not be migrated yet → retry
      // with only the long-standing columns.
      if (error?.code === '42703' || error?.code === 'PGRST204') {
        const rest = { ...patch }
        delete rest.program_id
        delete rest.profile_public
        delete rest.at_concordia
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

  /** Update public-profile privacy (Settings): the public toggle and/or bio.
   * Optimistic + fire-and-forget; only meaningful once the migration has run. */
  const updatePrivacy = useCallback(
    (patch: { profilePublic?: boolean; bio?: string }) => {
      if (!authUser) return
      setRow((r) => (r ? { ...r, ...('profilePublic' in patch ? { profile_public: patch.profilePublic } : {}), ...('bio' in patch ? { bio: patch.bio } : {}) } : r))
      const row: Record<string, unknown> = {}
      if (patch.profilePublic !== undefined) row.profile_public = patch.profilePublic
      if (patch.bio !== undefined) row.bio = patch.bio
      if (Object.keys(row).length)
        fireWrite(supabase.from('user_profile').update(row).eq('user_id', authUser.id))
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

  // Optimistically reflect a granted Pro window (the survey reward already wrote
  // pro_until server-side) so the plan flips live without a reload.
  const applyProUntil = useCallback((iso: string) => {
    setRow((r) => (r ? { ...r, pro_until: iso } : r))
  }, [])

  return {
    user,
    plan: user.plan,
    setPlan,
    applyProUntil,
    updateProfile,
    setProgram,
    updatePrivacy,
    onboardingCompleted,
    completeOnboarding,
    changeHandle,
  }
}
