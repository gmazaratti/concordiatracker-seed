import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext, type Theme } from './theme'

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

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'maroon' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, toggleTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
