import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'

/**
 * Page transitions, with the browser's View Transitions API. CSS only (the
 * animations are in index.css under `.ct-vt-*`), no animation library.
 *
 * Three kinds:
 * - `enter-app`: landing page → dashboard. The landing settles back and fades,
 *   the app rises in over it.
 * - `leave-app`: dashboard → landing page, the same move in reverse.
 * - `tab`: between the app's tabs. Only the main column moves (the sidebar is
 *   the same on both sides, so animating it would read as a flicker).
 *
 * Falls back to a plain navigation where the API is missing (Firefox), when
 * the viewer asked for reduced motion, and for modifier-clicks (new tab).
 */
export type TransitionKind = 'enter-app' | 'leave-app' | 'tab'

/**
 * Tabs whose page has rendered at least once this session.
 *
 * Every tab except Today is lazy-loaded, and a lazy page shows its loading
 * fallback on its FIRST render. A transition into that would cross-fade into
 * a spinner and then pop, which is worse than no transition. So a tab only
 * animates once its page has been seen; the first visit is a plain switch.
 * Filled by StudentLayout as you move around.
 */
const renderedTabs = new Set<string>(['/app'])

export function tabKey(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  return '/' + parts.slice(0, 2).join('/')
}

export function markTabRendered(pathname: string): void {
  renderedTabs.add(tabKey(pathname))
}

type Doc = Document & { startViewTransition?: (cb: () => void) => { finished?: Promise<void> } }

function canAnimate(e?: React.MouseEvent): boolean {
  const doc = document as Doc
  if (!doc.startViewTransition) return false
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Run `go` (a navigation) inside a view transition of the given kind. */
export function runTransition(kind: TransitionKind, go: () => void): void {
  const doc = document as Doc
  const cls = `ct-vt-${kind}`
  document.documentElement.classList.add(cls)
  const clear = () => document.documentElement.classList.remove(cls)
  try {
    const t = doc.startViewTransition!(() => flushSync(go))
    if (t.finished) void t.finished.then(clear, clear)
    else clear()
  } catch {
    clear()
    go()
  }
}

/**
 * An onClick for a `<Link>`/`<NavLink>` that animates the navigation.
 * Returns a handler; the link keeps its `to`, so a modifier-click still opens
 * a new tab and the address is still a real, shareable link.
 */
export function useTransitionClick() {
  const navigate = useNavigate()
  return (to: string, kind: TransitionKind, extra?: () => void) => (e: React.MouseEvent) => {
    extra?.()
    if (!canAnimate(e)) return
    if (kind === 'tab') {
      const here = window.location.pathname
      if (tabKey(here) === tabKey(to) && here === to) return
      if (!renderedTabs.has(tabKey(to))) return
    }
    e.preventDefault()
    runTransition(kind, () => navigate(to))
  }
}
