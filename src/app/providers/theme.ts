import { createContext, useContext } from 'react'

export type Theme = 'dark' | 'maroon' | 'light' | 'purple' | 'rose'

export interface ThemeOption {
  id: Theme
  label: string
  /** swatch colors for the switcher preview: [canvas, accent] */
  swatch: [string, string]
  /** Card surface, for the larger preview in Settings. */
  surface: string
  /** Whether the preview needs dark or light text on it. */
  scheme: 'dark' | 'light'
}

export const THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Refined Dark', swatch: ['#0f0f16', '#8fb39a'], surface: '#191926', scheme: 'dark' },
  { id: 'maroon', label: 'Concordia Maroon', swatch: ['#1a0d12', '#e8b84b'], surface: '#261620', scheme: 'dark' },
  { id: 'purple', label: 'Purple Dark', swatch: ['#181a3d', '#7c3aed'], surface: '#1f2350', scheme: 'dark' },
  { id: 'light', label: 'Light', swatch: ['#f5f6f4', '#46785a'], surface: '#ffffff', scheme: 'light' },
  { id: 'rose', label: 'Light Rose', swatch: ['#fdf6f8', '#c04a72'], surface: '#ffffff', scheme: 'light' },
]

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
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
