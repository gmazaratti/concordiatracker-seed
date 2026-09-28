import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth'
import { supabase, fireWrite } from '@/lib/supabase'
import { isNetworkError } from '@/lib/offline-cache'
import { OFFLINE_COPY } from '@/lib/offline-fetch'
import { UiStateContext, localDay, type UiState } from './ui-state'

// Stable reference for the signed-out / not-yet-loaded case (so it doesn't churn memo deps).
const EMPTY: UiState = {}

const LOCAL = (uid: string) => `ct_ui_state_${uid}`

function readLocal(uid: string): UiState | null {
  try {
    const raw = localStorage.getItem(LOCAL(uid))
    return raw ? (JSON.parse(raw) as UiState) : null
  } catch {
    return null
  }
}

function writeLocal(uid: string, state: UiState) {
  try {
    localStorage.setItem(LOCAL(uid), JSON.stringify(state))
  } catch {
    /* storage blocked: the server copy is still the truth */
  }
}

/**
 * Loads + persists the per-user UI flags (checklist dismissal, community-visited,
 * one-time tips, the tour prompt). Read SEPARATELY from the main profile so a
 * not-yet-migrated `ui_state` column just yields {} and never blocks the app.
 *
 * A FAILED READ IS NOT AN EMPTY STATE. This used to treat "the network is gone"
 * as `{}`, which is exactly what a brand-new account looks like — so airplane
 * mode greeted a returning student with "You're new here" and the tour. Now:
 *
 *   - a copy of the state is kept on this device, and an unreachable server
 *     uses it;
 *   - with no copy, the state is simply NOT LOADED, and every one-time prompt
 *     already waits for `loaded`;
 *   - while it is not SYNCED (read from the server this session), changes are
 *     kept locally and merged into a fresh server copy on reconnect. Writing
 *     the whole object from an old copy would wipe whatever changed elsewhere
 *     (a widget layout set on the laptop) the moment the phone reconnected.
 */
export function UiStateProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth()
  const [uiState, setUiState] = useState<UiState>({})
  // The user id whose state is currently loaded — so `loaded` flips false on a
  // user switch without a synchronous setState in the effect.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const stateRef = useRef<UiState>({})
  const synced = useRef(false)
  const pending = useRef<Partial<UiState>>({})
  const forUid = useRef<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    stateRef.current = uiState
  }, [uiState])

  useEffect(() => {
    if (!authUser) return
    const uid = authUser.id
    // A different account: nothing it has is synced, and nothing queued for
    // the previous one may be merged into it.
    if (forUid.current !== uid) {
      forUid.current = uid
      synced.current = false
      pending.current = {}
    }
    let active = true
    void (async () => {
      const res = await supabase.from('user_profile').select('ui_state').eq('user_id', uid).maybeSingle()
      if (!active) return
      const fromDevice = res.statusText === OFFLINE_COPY
      if (res.error && isNetworkError(res.error)) {
        const saved = readLocal(uid)
        if (saved) {
          setUiState({ ...saved, ...pending.current })
          setLoadedFor(uid)
        }
        // No saved copy and no server: stay NOT loaded. Nothing that waits on
        // `loaded` (the tour, the survey, tips) may fire on a guess.
        return
      }
      const server: UiState = !res.error && res.data?.ui_state ? (res.data.ui_state as UiState) : {}
      if (fromDevice) {
        setUiState({ ...server, ...pending.current })
        setLoadedFor(uid)
        return
      }
      // A real server read. Merge anything changed while offline on top.
      synced.current = true
      const today = localDay()
      const days = server.visitDays ?? []
      let next: UiState = { ...server, ...pending.current }
      if (!days.includes(today)) next = { ...next, visitDays: [...days, today].slice(-120) }
      const changed = next !== server && JSON.stringify(next) !== JSON.stringify(server)
      pending.current = {}
      if (changed) fireWrite(supabase.from('user_profile').update({ ui_state: next }).eq('user_id', uid))
      writeLocal(uid, next)
      setUiState(next)
      setLoadedFor(uid)
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, retry])

  // Not synced yet: try again when the connection comes back.
  useEffect(() => {
    const again = () => {
      if (!synced.current) setRetry((n) => n + 1)
    }
    window.addEventListener('online', again)
    window.addEventListener('ct:offline-synced', again)
    return () => {
      window.removeEventListener('online', again)
      window.removeEventListener('ct:offline-synced', again)
    }
  }, [])

  const loaded = !!authUser && loadedFor === authUser.id
  const state = loaded ? uiState : EMPTY

  const patchUiState = useCallback(
    (patch: Partial<UiState>) => {
      if (!authUser) return
      const merged = { ...stateRef.current, ...patch }
      setUiState(merged) // optimistic
      writeLocal(authUser.id, merged)
      if (!synced.current) {
        // Offline or not yet read: remember only what CHANGED, for the merge.
        pending.current = { ...pending.current, ...patch }
        return
      }
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
