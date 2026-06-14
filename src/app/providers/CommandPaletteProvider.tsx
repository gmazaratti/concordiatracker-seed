import { useCallback, useEffect, useMemo, useState } from 'react'
import { CommandPaletteContext } from './command-palette'

/** Owns palette open state and the global Cmd/Ctrl+K shortcut. */
export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  const value = useMemo(
    () => ({ open, openPalette, closePalette, toggle }),
    [open, openPalette, closePalette, toggle],
  )

  return (
    <CommandPaletteContext value={value}>{children}</CommandPaletteContext>
  )
}
