/**
 * The "Reduce motion" setting, which until now was a `useState(false)` that
 * persisted nothing and animated nothing — a switch you could flip forever
 * with no effect on either the page or the next page load.
 *
 * IT SETS AN ATTRIBUTE, IT DOES NOT RE-IMPLEMENT THE RULES. `index.css`
 * already zeroes every duration under `prefers-reduced-motion: reduce`; the
 * setting adds `html[data-reduce-motion]` as a second selector on that same
 * block. So there is ONE definition of what reduced motion means, and a
 * component that was written to be safe under the OS setting is safe under
 * this one for free.
 *
 * Applied at MODULE LOAD rather than in an effect: an effect runs after the
 * first paint, which is exactly when the entrance animations play, so the
 * setting would be ignored on the load where it matters most.
 */
const KEY = 'ct_reduce_motion'

/** The OS asked for it, or the person did. Either is a yes. */
export function systemPrefersReduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function getReduceMotion(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // Private mode, blocked storage. Not a reason to fail.
    return false
  }
}

export function applyReduceMotion(on: boolean): void {
  const el = document.documentElement
  if (on) el.setAttribute('data-reduce-motion', '')
  else el.removeAttribute('data-reduce-motion')
}

export function setReduceMotion(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // The attribute below still applies for this session.
  }
  applyReduceMotion(on)
}

// Run on import, before React mounts.
applyReduceMotion(getReduceMotion())
