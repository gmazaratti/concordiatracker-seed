import { useCallback, useState } from 'react'

/**
 * State that survives a reload, on this device.
 *
 * The view toggles and the Customize-Today panel were "sticky across SPA nav,
 * resets on reload" — a deliberate choice back when the whole app was a mock
 * with no persistence anywhere. It stopped being defensible the moment the app
 * had real accounts: someone who picks List, refreshes, and gets Grid back
 * concludes the button does not work.
 *
 * localStorage rather than the profile, because these are properties of the
 * SCREEN you are looking at — a dense list makes sense on a laptop and not on a
 * phone — the same reasoning as the collapsed sidebar. Layouts you BUILD, like
 * the Today widget order, still live in `ui_state` and follow you between
 * devices.
 *
 * Objects are merged over the default on read, so adding a field later does not
 * strand everyone who has an older blob saved.
 */
export function usePersisted<T>(
  key: string,
  fallback: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback))

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // A private window, or storage that is full. The choice still applies
          // for this session; it simply will not outlive it.
        }
        return resolved
      })
    },
    [key],
  )

  return [value, set]
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw) as T
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      fallback &&
      typeof fallback === 'object'
    ) {
      return { ...fallback, ...parsed }
    }
    return parsed
  } catch {
    return fallback
  }
}
