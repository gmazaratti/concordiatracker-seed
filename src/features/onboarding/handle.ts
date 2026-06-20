import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/

/** Debounced live check of whether a handle is free (via the handle_available
 * RPC). Degrades to 'idle' if the RPC isn't present yet, so onboarding still
 * works — the submit-time unique-violation catch is the backstop. */
export function useHandleCheck(handle: string): 'idle' | 'free' | 'taken' {
  const [checked, setChecked] = useState<{ handle: string; available: boolean } | null>(null)
  useEffect(() => {
    if (!HANDLE_RE.test(handle)) return
    let active = true
    const t = setTimeout(() => {
      void supabase.rpc('handle_available', { p_handle: handle }).then(({ data, error }) => {
        if (active && !error) setChecked({ handle, available: data === true })
      })
    }, 450)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [handle])
  if (checked == null || checked.handle !== handle) return 'idle'
  return checked.available ? 'free' : 'taken'
}
