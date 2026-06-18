import { ThemeProvider } from './ThemeProvider'
import { CommandPaletteProvider } from './CommandPaletteProvider'
import { AppDataProvider } from './AppDataProvider'
import { QuickActionsProvider } from './QuickActionsProvider'
import { SettingsProvider } from './SettingsProvider'
import { UpdatesProvider } from './UpdatesProvider'
import { FollowsProvider } from './FollowsProvider'
import { TeacherProvider } from './TeacherProvider'

/** Single composition point for cross-cutting providers. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <TeacherProvider>
          <FollowsProvider>
            <SettingsProvider>
              <UpdatesProvider>
                <QuickActionsProvider>
                  <CommandPaletteProvider>{children}</CommandPaletteProvider>
                </QuickActionsProvider>
              </UpdatesProvider>
            </SettingsProvider>
          </FollowsProvider>
        </TeacherProvider>
      </AppDataProvider>
    </ThemeProvider>
  )
}
