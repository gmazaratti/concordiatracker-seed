import { ThemeProvider } from './ThemeProvider'
import { CommandPaletteProvider } from './CommandPaletteProvider'

/**
 * Single composition point for cross-cutting providers.
 * AppDataProvider (in-memory mock data) is added when screens need it.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CommandPaletteProvider>{children}</CommandPaletteProvider>
    </ThemeProvider>
  )
}
