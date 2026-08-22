import { ThemeProvider } from './ThemeProvider'
import { I18nProvider } from '@/i18n/I18nProvider'
import { CommandPaletteProvider } from './CommandPaletteProvider'
import { AppDataProvider } from './AppDataProvider'
import { ThemeEntitlement } from './ThemeEntitlement'
import { UiStateProvider } from './UiStateProvider'
import { CommunityProvider } from './CommunityProvider'
import { QuickActionsProvider } from './QuickActionsProvider'
import { SettingsProvider } from './SettingsProvider'
import { SupportProvider } from './SupportProvider'
import { UpdatesProvider } from './UpdatesProvider'
import { FollowsProvider } from './FollowsProvider'
import { TeacherProvider } from './TeacherProvider'

/** Single composition point for cross-cutting providers. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
    <ThemeProvider>
      <AppDataProvider>
        {/* Renders nothing; keeps the active theme and the active plan in
            agreement wherever the app runs, not only where the picker is. */}
        <ThemeEntitlement />
        <UiStateProvider>
          <CommunityProvider>
          <TeacherProvider>
            <FollowsProvider>
              <SettingsProvider>
                <SupportProvider>
                <UpdatesProvider>
                  <QuickActionsProvider>
                    <CommandPaletteProvider>{children}</CommandPaletteProvider>
                  </QuickActionsProvider>
                </UpdatesProvider>
                </SupportProvider>
              </SettingsProvider>
            </FollowsProvider>
          </TeacherProvider>
          </CommunityProvider>
        </UiStateProvider>
      </AppDataProvider>
    </ThemeProvider>
    </I18nProvider>
  )
}
