import { createContext, useContext } from 'react'

export type Theme = 'dark' | 'maroon' | 'light' | 'purple'

export interface ThemeOption {
  id: Theme
  label: string
  /** swatch colors for the switcher preview: [canvas, accent] */
  swatch: [string, string]
}

export const THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Refined Dark', swatch: ['#0f0f16', '#8fb39a'] },
  { id: 'maroon', label: 'Concordia Maroon', swatch: ['#1a0d12', '#e8b84b'] },
  { id: 'light', label: 'Light', swatch: ['#f5f6f4', '#46785a'] },
  { id: 'purple', label: 'Purple Dark', swatch: ['#181a3d', '#7c3aed'] },
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
