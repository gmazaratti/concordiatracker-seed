import { createContext, useContext } from 'react'

export type Theme = 'dark' | 'maroon' | 'light' | 'purple' | 'rose' | 'custom'

export interface ThemeOption {
  id: Theme
  label: string
  /** swatch colors for the switcher preview: [canvas, accent] */
  swatch: [string, string]
  /** Card surface, for the larger preview in Settings. */
  surface: string
  /** Whether the preview needs dark or light text on it. */
  scheme: 'dark' | 'light'
  /**
   * Part of the Semester pass.
   *
   * Dark and Light are free, and always will be: a product that makes you pay
   * to not be blinded at 2am is a product that deserves the review it gets.
   * What Pro buys is the rest of the palette and a colour of your own.
   */
  pro?: boolean
}

export const THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Refined Dark', swatch: ['#0f0f16', '#8fb39a'], surface: '#191926', scheme: 'dark' },
  { id: 'light', label: 'Light', swatch: ['#f5f6f4', '#46785a'], surface: '#ffffff', scheme: 'light' },
  { id: 'maroon', label: 'Concordia Maroon', swatch: ['#1a0d12', '#e8b84b'], surface: '#261620', scheme: 'dark', pro: true },
  { id: 'purple', label: 'Purple Dark', swatch: ['#181a3d', '#7c3aed'], surface: '#1f2350', scheme: 'dark', pro: true },
  { id: 'rose', label: 'Light Rose', swatch: ['#fdf6f8', '#c04a72'], surface: '#ffffff', scheme: 'light', pro: true },
]

/**
 * A theme the student builds: one of the two base palettes, plus a colour.
 *
 * Two colours at most: an accent, and optionally the page itself. What is NOT
 * offered is the text — that is derived from the page in `lib/color.ts`, along
 * with the card and border steps, so a chosen background can change the mood
 * but never the readability. Choosing both a background and a text colour is
 * how you get grey on grey and a support ticket.
 */
export interface CustomTheme {
  /** Which built-in palette the derivations lean on, and the fallback page
   *  colour when no `canvas` is chosen. */
  base: 'dark' | 'light'
  accent: string
  /**
   * A page colour of their own. Optional on purpose: most people want a colour
   * for the buttons and a background someone else already tuned, and asking
   * everyone to pick two colours to get one is how a nice feature becomes a
   * chore. Undefined means "just use dark or light".
   */
  canvas?: string
}

export const DEFAULT_CUSTOM: CustomTheme = { base: 'dark', accent: '#7aa2f7' }

/** Whether picking this theme requires the Semester pass. */
export function isProTheme(id: Theme): boolean {
  return id === 'custom' || (THEMES.find((t) => t.id === id)?.pro ?? false)
}

/** Viewport point a theme change should sweep out from (usually a click). */
export interface ThemeOrigin {
  x: number
  y: number
}

export interface ThemeContextValue {
  theme: Theme
  /** Pass the click point to play the circular reveal; omit it to swap instantly. */
  setTheme: (theme: Theme, origin?: ThemeOrigin) => void
  toggleTheme: (origin?: ThemeOrigin) => void
  custom: CustomTheme
  setCustom: (next: CustomTheme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
