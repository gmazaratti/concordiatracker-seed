import { createContext, useContext } from 'react'

export type Theme = 'dark' | 'maroon'

export interface ThemeOption {
  id: Theme
  label: string
  /** swatch colors for the switcher preview: [canvas, accent] */
  swatch: [string, string]
}

export const THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Refined Dark', swatch: ['#0f0f16', '#8fb39a'] },
  { id: 'maroon', label: 'Concordia Maroon', swatch: ['#1a0d12', '#e8b84b'] },
]

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
