import { useEffect, useRef } from 'react'
import { useTheme } from './theme'
import { freeFallbackFor, isProTheme, THEMES, type Theme } from './theme'
import { useAppData } from './app-data'

/** Where a Pro theme is parked while the pass is not active, so it can come
 *  back on its own the moment it is. */
const HELD_KEY = 'ct_theme_held'

/**
 * Keeps the active theme and the active plan in agreement.
 *
 * The picker gates SELECTION, which is not the same thing: a pass bought in
 * April leaves someone on Concordia Maroon in September, wearing a paid feature
 * for free. So the check runs wherever the app runs, not only where the grid is.
 *
 * It is a downgrade, not a punishment. The theme is HELD rather than discarded,
 * and the moment the pass is active again it comes straight back — because the
 * alternative is asking someone who just paid to go and find their colours.
 * The fallback matches the scheme they chose, so a light theme stays light.
 *
 * Renders nothing.
 */
export function ThemeEntitlement() {
  const { plan, dataLoading } = useAppData()
  const { theme, custom, setTheme } = useTheme()
  // Only ever act when something actually changed, so this cannot fight the
  // user mid-click or loop against its own write.
  const last = useRef<string>('')

  useEffect(() => {
    // A plan we have not loaded yet reads as 'free', and acting on it would
    // strip the theme of every paying customer for a moment on every boot.
    if (dataLoading) return
    const pro = plan === 'semester'
    const key = `${plan}:${theme}`
    if (last.current === key) return
    last.current = key

    if (!pro && isProTheme(theme)) {
      try {
        localStorage.setItem(HELD_KEY, theme)
      } catch {
        /* private mode — it just will not come back on its own */
      }
      setTheme(freeFallbackFor(theme, custom))
      return
    }

    if (pro) {
      let held: string | null = null
      try {
        held = localStorage.getItem(HELD_KEY)
      } catch {
        /* nothing held */
      }
      // Restore only onto the fallback we ourselves set. If they have since
      // picked something else, that is a choice, and choices win.
      const valid = held === 'custom' || THEMES.some((t) => t.id === held)
      if (valid && held && (theme === 'dark' || theme === 'light')) {
        try {
          localStorage.removeItem(HELD_KEY)
        } catch {
          /* ignore */
        }
        setTheme(held as Theme)
      }
    }
  }, [plan, dataLoading, theme, custom, setTheme])

  return null
}
