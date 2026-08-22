import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  ThemeContext,
  THEMES,
  DEFAULT_CUSTOM,
  type CustomTheme,
  type Theme,
  type ThemeOrigin,
} from './theme'
import { customTheme } from '@/lib/color'

const DEFAULT_THEME: Theme = 'dark'
const STORAGE_KEY = 'ct_theme'
const CUSTOM_KEY = 'ct_theme_custom'
const VARS_KEY = 'ct_theme_vars'
/** Long enough to read as a sweep, short enough not to be in the way. */
const REVEAL_MS = 600
/**
 * How long a locked theme stays on before it hands itself back.
 *
 * Long enough to open a couple of screens and form an opinion; short enough
 * that it is unmistakably a trial rather than the theme quietly being free.
 * It ends itself, so nobody is left wondering why their app looks different.
 */
const PREVIEW_MS = 120_000

/** The saved theme (localStorage), validated against the registered set. */
function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'custom' || (saved && THEMES.some((t) => t.id === saved))) return saved as Theme
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_THEME
}

/** The saved custom palette. Anything malformed falls back rather than throwing. */
function readStoredCustom(): CustomTheme {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (
        parsed &&
        typeof parsed === 'object' &&
        'accent' in parsed &&
        typeof (parsed as CustomTheme).accent === 'string'
      ) {
        const c = parsed as CustomTheme
        return {
          base: c.base === 'light' ? 'light' : 'dark',
          accent: c.accent,
          ...(typeof c.canvas === 'string' ? { canvas: c.canvas } : {}),
        }
      }
    }
  } catch {
    /* unreadable or unparseable — use the default */
  }
  return DEFAULT_CUSTOM
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
  const [custom, setCustomState] = useState<CustomTheme>(readStoredCustom)
  const [preview, setPreview] = useState<Theme | null>(null)

  // What is on screen. A preview paints but is never saved, so the app you come
  // back to is the one you chose.
  const active = preview ?? theme

  useEffect(() => {
    const root = document.documentElement
    // A custom theme rides ON one of the base palettes. data-theme still names
    // that base, so everything NOT derived here — shadows, the status and
    // provenance colours — keeps its tuned value; only what we compute is
    // overwritten inline.
    const { base, tokens } = customTheme(custom)
    root.dataset.theme = active === 'custom' ? base : active
    for (const name of Object.keys(tokens)) {
      if (active === 'custom') root.style.setProperty(name, tokens[name])
      else root.style.removeProperty(name)
    }

    // Only the chosen theme is persisted. Storing a preview would survive the
    // reload that is meant to end it.
    if (preview) return

    try {
      localStorage.setItem(STORAGE_KEY, theme)
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom))
      // Cached for the pre-paint script in index.html, which replays these
      // rather than reimplementing the derivation.
      localStorage.setItem(VARS_KEY, JSON.stringify(tokens))
    } catch {
      /* localStorage unavailable — theme just won't persist */
    }
  }, [active, preview, theme, custom])

  /**
   * Apply a state change under the circular reveal.
   *
   * Shared by choosing a theme and trying one on, so a preview cannot end up
   * feeling like a different, cheaper interaction than the real thing.
   */
  const swap = useCallback((apply: () => void, origin?: ThemeOrigin) => {
    const doc = document as ViewTransitionDoc
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // No click point, no support, or motion turned down → just swap.
    if (!origin || reduced || typeof doc.startViewTransition !== 'function') {
      apply()
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
      flushSync(apply)
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

  const setTheme = useCallback(
    (next: Theme, origin?: ThemeOrigin) => {
      // Choosing anything ends a preview: the choice IS the answer to it.
      swap(() => {
        setPreview(null)
        setThemeState(next)
      }, origin)
    },
    [swap],
  )

  /** Try a theme on. Same sweep as choosing one — it should feel identical,
   *  because the whole point is finding out what it feels like. */
  const startPreview = useCallback(
    (next: Theme, origin?: ThemeOrigin) => {
      swap(() => setPreview(next), origin)
    },
    [swap],
  )

  const endPreview = useCallback(
    (origin?: ThemeOrigin) => {
      swap(() => setPreview(null), origin)
    },
    [swap],
  )

  // It hands itself back. An unattended preview that never ends is just the
  // paid theme, and a student who wandered off should not return to a palette
  // they did not choose with no idea how it got there.
  useEffect(() => {
    if (!preview) return
    const id = window.setTimeout(() => setPreview(null), PREVIEW_MS)
    return () => window.clearTimeout(id)
  }, [preview])

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

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      custom,
      setCustom: setCustomState,
      preview,
      startPreview,
      endPreview,
    }),
    [theme, setTheme, toggleTheme, custom, preview, startPreview, endPreview],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
