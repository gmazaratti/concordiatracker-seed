import { createContext, useContext } from 'react'

/** A command-palette shortcut. The platform modifier (⌘ on Mac, Ctrl elsewhere)
 * is always required; the user can change the key and whether Shift is held. */
export interface Shortcut {
  key: string
  shift: boolean
}

export const DEFAULT_SHORTCUT: Shortcut = { key: 'k', shift: false }

const IS_MAC =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent)

/** Human-readable shortcut: "⌘K" on Mac, "Ctrl + Shift + K" elsewhere. */
export function formatShortcut(s: Shortcut): string {
  const key = s.key.length === 1 ? s.key.toUpperCase() : s.key.replace(/^./, (c) => c.toUpperCase())
  if (IS_MAC) return `${s.shift ? '⇧' : ''}⌘${key}`
  return ['Ctrl', s.shift ? 'Shift' : '', key].filter(Boolean).join(' + ')
}

/** Does a keydown match the configured shortcut? (⌘/Ctrl required, Alt must be off.) */
export function matchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  return (
    (e.metaKey || e.ctrlKey) && !e.altKey && e.shiftKey === s.shift && e.key.toLowerCase() === s.key
  )
}

export interface CommandPaletteContextValue {
  open: boolean
  openPalette: () => void
  closePalette: () => void
  toggle: () => void
  /** The current open-palette shortcut (in-memory, like the other prefs). */
  shortcut: Shortcut
  setShortcut: (s: Shortcut) => void
  /** Record the next ⌘/Ctrl-key combo the user presses (for the Settings
   * control), instead of toggling the palette. `onDone(null)` if they press
   * Escape. Returns a cancel function. */
  beginCapture: (onDone: (s: Shortcut | null) => void) => () => void
}

export const CommandPaletteContext =
  createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx)
    throw new Error(
      'useCommandPalette must be used within <CommandPaletteProvider>',
    )
  return ctx
}
