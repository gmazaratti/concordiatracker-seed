import { ThemeProvider } from './ThemeProvider'
import { CommandPaletteProvider } from './CommandPaletteProvider'
import { AppDataProvider } from './AppDataProvider'

/** Single composition point for cross-cutting providers. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <CommandPaletteProvider>{children}</CommandPaletteProvider>
      </AppDataProvider>
    </ThemeProvider>
  )
}
