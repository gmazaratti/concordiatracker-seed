import { ThemeProvider } from './ThemeProvider'
import { CommandPaletteProvider } from './CommandPaletteProvider'
import { AppDataProvider } from './AppDataProvider'
import { QuickActionsProvider } from './QuickActionsProvider'

/** Single composition point for cross-cutting providers. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <QuickActionsProvider>
          <CommandPaletteProvider>{children}</CommandPaletteProvider>
        </QuickActionsProvider>
      </AppDataProvider>
    </ThemeProvider>
  )
}
