import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import type { FeatureUsage } from '@/lib/discovery'

/**
 * Which features this account has used (db/feature_usage.sql), shared by the
 * discovery nudges and the starter-task dots on the tabs.
 *
 * Re-read when the page changes (at most every 8 seconds), so a dot that says
 * "make your first note" goes away when you come back from making one, not on
 * the next reload.
 */
let current: { uid: string; usage: FeatureUsage } | null = null
let lastFetch = 0
let inflight = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function refresh(uid: string, force = false) {
  if (!uid || inflight) return
  if (!force && current?.uid === uid && Date.now() - lastFetch < 8000) return
  inflight = true
  lastFetch = Date.now()
  void supabase.rpc('my_feature_usage').then(({ data, error }) => {
    inflight = false
    if (error || !data) return
    current = { uid, usage: data as FeatureUsage }
    emit()
  })
}

export function useFeatureUsage(): FeatureUsage | null {
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const { pathname } = useLocation()
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
  useEffect(() => {
    refresh(uid)
  }, [uid, pathname])
  return snap && snap.uid === uid ? snap.usage : null
}
