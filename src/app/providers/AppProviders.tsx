import { ThemeProvider } from './ThemeProvider'
import { CommandPaletteProvider } from './CommandPaletteProvider'
import { AppDataProvider } from './AppDataProvider'
import { QuickActionsProvider } from './QuickActionsProvider'
import { SettingsProvider } from './SettingsProvider'

/** Single composition point for cross-cutting providers. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <SettingsProvider>
          <QuickActionsProvider>
            <CommandPaletteProvider>{children}</CommandPaletteProvider>
          </QuickActionsProvider>
        </SettingsProvider>
      </AppDataProvider>
    </ThemeProvider>
  )
}
