import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { useAppData } from '@/app/providers/app-data'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { Sidebar } from '@/components/Sidebar'
import { MobileNav } from '@/components/MobileNav'
import { Logo } from '@/components/Logo'
import { AvatarMenu } from '@/components/AvatarMenu'
import { CommandPalette } from '@/command/CommandPalette'
import { QuickActionLayer } from '@/command/QuickActionLayer'
import { SettingsLayer } from '@/features/settings/SettingsLayer'
import { UpdatesLayer } from '@/features/updates/UpdatesLayer'
import { InstallPrompt } from '@/components/InstallPrompt'

/** Chrome for the authenticated student app context. Gated: the whole `/app`
 * area requires a signed-in session — otherwise the login screen takes over. */
export function StudentLayout() {
  const { user, loading } = useAuth()
  const { onboardingCompleted } = useAppData()

  // First-login onboarding gate. Wait for the profile to load (null) so a
  // returning, already-onboarded user never flashes the app before redirecting.
  if (loading || (user && onboardingCompleted === null)) {
    return (
      <div className="grid h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (!user) return <LoginScreen />
  if (onboardingCompleted === false) return <Navigate to="/onboarding" replace />

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — pad past the status bar / notch in standalone mode */}
        <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] md:hidden">
          <Logo />
          <AvatarMenu align="top" compact />
        </header>

        {/* Bottom padding clears the mobile nav, which itself grows by the home-indicator inset */}
        <main className="relative flex-1 overflow-y-auto pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
      <QuickActionLayer />
      <SettingsLayer />
      <UpdatesLayer />
      <InstallPrompt />
    </div>
  )
}
