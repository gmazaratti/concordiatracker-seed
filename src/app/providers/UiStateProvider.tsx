import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth'
import { supabase, fireWrite } from '@/lib/supabase'
import { UiStateContext, type UiState } from './ui-state'

// Stable reference for the signed-out / not-yet-loaded case (so it doesn't churn memo deps).
const EMPTY: UiState = {}

/**
 * Loads + persists the per-user UI flags (checklist dismissal, community-visited,
 * one-time tips). Read SEPARATELY from the main profile so a not-yet-migrated
 * `ui_state` column just yields {} and never blocks the app. Writes are
 * optimistic + fire-and-forget; before the migration they no-op silently
 * (in-session state still works, just doesn't persist).
 */
export function UiStateProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth()
  const [uiState, setUiState] = useState<UiState>({})
  // The user id whose state is currently loaded — so `loaded` flips false on a
  // user switch without a synchronous setState in the effect.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const stateRef = useRef<UiState>({})
  useEffect(() => {
    stateRef.current = uiState
  }, [uiState])

  useEffect(() => {
    if (!authUser) return
    let active = true
    void (async () => {
      const { data, error } = await supabase
        .from('user_profile')
        .select('ui_state')
        .eq('user_id', authUser.id)
        .maybeSingle()
      if (!active) return
      setUiState(!error && data?.ui_state ? (data.ui_state as UiState) : {})
      setLoadedFor(authUser.id)
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id])

  const loaded = !!authUser && loadedFor === authUser.id
  const state = loaded ? uiState : EMPTY

  const patchUiState = useCallback(
    (patch: Partial<UiState>) => {
      if (!authUser) return
      const merged = { ...stateRef.current, ...patch }
      setUiState(merged) // optimistic
      fireWrite(supabase.from('user_profile').update({ ui_state: merged }).eq('user_id', authUser.id))
    },
    [authUser],
  )

  const markTipSeen = useCallback(
    (id: string) => {
      const seen = stateRef.current.tipsSeen ?? []
      if (!seen.includes(id)) patchUiState({ tipsSeen: [...seen, id] })
    },
    [patchUiState],
  )

  const value = useMemo(
    () => ({
      uiState: state,
      loaded,
      patchUiState,
      markTipSeen,
      isTipSeen: (id: string) => (state.tipsSeen ?? []).includes(id),
    }),
    [state, loaded, patchUiState, markTipSeen],
  )

  return <UiStateContext value={value}>{children}</UiStateContext>
}
