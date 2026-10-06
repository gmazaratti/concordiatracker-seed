import { useState } from 'react'

/**
 * A per-device display preference (paper on/off, zoom, panel open). Device,
 * not account: how wide your screen is decides these, so a laptop and a big
 * monitor can differ. Storage can be missing or blocked; it then just resets.
 */
export function useLocalPref<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* private window: the choice lasts this visit */
    }
  }
  return [value, set]
}
