import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CommandPaletteContext,
  DEFAULT_SHORTCUT,
  matchesShortcut,
  type Shortcut,
} from './command-palette'

/** Modifier keys that aren't valid as the shortcut's main key. */
const MOD_KEYS = new Set(['control', 'meta', 'shift', 'alt'])

/** Owns palette open state and the global, user-configurable open shortcut. */
export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [shortcut, setShortcut] = useState<Shortcut>(DEFAULT_SHORTCUT)
  // While set, the next valid combo is captured for the Settings control
  // instead of toggling the palette.
  const captureRef = useRef<((s: Shortcut | null) => void) | null>(null)

  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])

  const beginCapture = useCallback((onDone: (s: Shortcut | null) => void) => {
    captureRef.current = onDone
    return () => {
      captureRef.current = null
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Capture mode — Settings is recording a new shortcut.
      const capture = captureRef.current
      if (capture) {
        if (e.key === 'Escape') {
          e.preventDefault()
          captureRef.current = null
          capture(null)
          return
        }
        const k = e.key.toLowerCase()
        if ((e.metaKey || e.ctrlKey) && !e.altKey && !MOD_KEYS.has(k)) {
          e.preventDefault()
          captureRef.current = null
          capture({ key: k, shift: e.shiftKey })
        }
        return // swallow other keys while capturing
      }
      // Normal — toggle on the configured shortcut.
      if (matchesShortcut(e, shortcut)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle, shortcut])

  const value = useMemo(
    () => ({ open, openPalette, closePalette, toggle, shortcut, setShortcut, beginCapture }),
    [open, openPalette, closePalette, toggle, shortcut, beginCapture],
  )

  return (
    <CommandPaletteContext value={value}>{children}</CommandPaletteContext>
  )
}
