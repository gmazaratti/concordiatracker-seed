import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext, THEMES, type Theme } from './theme'

const DEFAULT_THEME: Theme = 'dark'
const STORAGE_KEY = 'ct_theme'

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

/**
 * Theme state, persisted to localStorage so it survives reloads (per device).
 * Writes the active theme to <html data-theme> so the token overrides in
 * index.css take effect across the whole tree. An inline script in index.html
 * applies the saved theme before first paint to avoid a flash.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* localStorage unavailable — theme just won't persist */
    }
  }, [theme])

  // Cycle through every registered theme (in THEMES order) so the palette's
  // "Switch theme" action reaches the new themes too. From 'dark' the first
  // step still lands on 'maroon', preserving the original behavior.
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const i = THEMES.findIndex((o) => o.id === t)
      return THEMES[(i + 1) % THEMES.length].id
    })
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, toggleTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
