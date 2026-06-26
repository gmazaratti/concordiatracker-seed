import { ThemeProvider } from './ThemeProvider'
import { CommandPaletteProvider } from './CommandPaletteProvider'
import { AppDataProvider } from './AppDataProvider'
import { UiStateProvider } from './UiStateProvider'
import { CommunityProvider } from './CommunityProvider'
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
        <UiStateProvider>
          <CommunityProvider>
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
          </CommunityProvider>
        </UiStateProvider>
      </AppDataProvider>
    </ThemeProvider>
  )
}
