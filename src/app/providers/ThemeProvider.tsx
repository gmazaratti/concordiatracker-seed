import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { ThemeContext, THEMES, type Theme, type ThemeOrigin } from './theme'

const DEFAULT_THEME: Theme = 'dark'
const STORAGE_KEY = 'ct_theme'
/** Long enough to read as a sweep, short enough not to be in the way. */
const REVEAL_MS = 600

/** The saved theme (localStorage), validated against the registered set. */
function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && THEMES.some((t) => t.id === saved)) return saved as Theme
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_THEME
}

/** The View Transitions API isn't in every TS DOM lib yet — narrow it here. */
type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> }
}

/**
 * Theme state, persisted to localStorage so it survives reloads (per device).
 * Writes the active theme to <html data-theme> so the token overrides in
 * index.css take effect across the whole tree. An inline script in index.html
 * applies the saved theme before first paint to avoid a flash.
 *
 * Switching themes plays a CIRCULAR REVEAL: the new palette wipes outward from
 * the swatch you clicked. Built on the View Transitions API — the browser
 * snapshots the old and new states for us, and we animate a clip-path circle
 * over the new one. Falls back to an instant swap where that's unsupported, or
 * when the visitor prefers reduced motion.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* localStorage unavailable — theme just won't persist */
    }
  }, [theme])

  const setTheme = useCallback((next: Theme, origin?: ThemeOrigin) => {
    const doc = document as ViewTransitionDoc
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // No click point, no support, or motion turned down → just swap.
    if (!origin || reduced || typeof doc.startViewTransition !== 'function') {
      setThemeState(next)
      return
    }

    const { x, y } = origin
    // Radius that reaches whichever viewport corner is furthest from the click,
    // so the circle always finishes covering the screen.
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    const transition = doc.startViewTransition(() => {
      // flushSync so the DOM is already on the new theme when the browser takes
      // its "after" snapshot — otherwise React batches and both frames match.
      flushSync(() => setThemeState(next))
    })

    void transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: REVEAL_MS,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          // Animate only the incoming snapshot, so the new theme sweeps over the old.
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
  }, [])

  // Cycle through every registered theme (in THEMES order) so the palette's
  // "Switch theme" action reaches the new themes too. From 'dark' the first
  // step still lands on 'maroon', preserving the original behavior.
  const toggleTheme = useCallback(
    (origin?: ThemeOrigin) => {
      const i = THEMES.findIndex((o) => o.id === theme)
      setTheme(THEMES[(i + 1) % THEMES.length].id, origin)
    },
    [theme, setTheme],
  )

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}
