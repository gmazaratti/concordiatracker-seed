import { useSyncExternalStore } from 'react'

/**
 * Which shape the schedule builder takes — TEMPORARY, so two layouts can be
 * compared on real data instead of argued about.
 *
 * - `classic`: three equal panes in the reading column. Concordia's own shape.
 * - `wide`: find and picked stack into one narrow rail, and the week takes
 *   every pixel that leaves. The week is the thing you are actually reading.
 *
 * Kept in localStorage rather than the user's profile because it is a dev
 * switch, not a preference anyone is promised. Delete this module and the
 * toggle once the winner is obvious; `classic` is the fallback everywhere, so
 * removing it cannot strand anybody in a layout that no longer exists.
 */
export type BuilderLayout = 'classic' | 'wide'

const KEY = 'ct_builder_layout'
const listeners = new Set<() => void>()

function read(): BuilderLayout {
  try {
    return localStorage.getItem(KEY) === 'wide' ? 'wide' : 'classic'
  } catch {
    return 'classic'
  }
}

// Cached so useSyncExternalStore's getSnapshot returns a stable value; reading
// localStorage on every render would be fine for strings, but the cache also
// keeps every subscriber consistent within a tick.
let current: BuilderLayout | null = null

export function getBuilderLayout(): BuilderLayout {
  current ??= read()
  return current
}

export function setBuilderLayout(next: BuilderLayout) {
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* private mode — it just won't persist */
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Both the page (which owns the width) and the builder read this. */
export function useBuilderLayout(): BuilderLayout {
  return useSyncExternalStore(subscribe, getBuilderLayout, () => 'classic')
}
