import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext, THEMES, type Theme } from './theme'

const DEFAULT_THEME: Theme = 'dark'

/**
 * In-memory theme state (no persistence, per the seed's mock-only rule).
 * Writes the active theme to <html data-theme> so the token overrides in
 * index.css take effect across the whole tree.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
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
