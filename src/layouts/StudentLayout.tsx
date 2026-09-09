import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { useAppData } from '@/app/providers/app-data'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { Sidebar } from '@/components/Sidebar'
import { MobileNav } from '@/components/MobileNav'
import { SurveyClaimLayer } from '@/features/survey/SurveyClaimLayer'
import { MobileSearchButton } from '@/components/MobileSearchButton'
import { Logo } from '@/components/Logo'
import { AvatarMenu } from '@/components/AvatarMenu'
import { CommandPalette } from '@/command/CommandPalette'
import { QuickActionLayer } from '@/command/QuickActionLayer'
import { SettingsLayer } from '@/features/settings/SettingsLayer'
import { SupportLayer } from '@/features/support/SupportLayer'
import { ThemePreviewBar } from '@/components/ThemePreviewBar'
import { UpdatesLayer } from '@/features/updates/UpdatesLayer'
import { SeatAlertLayer } from '@/features/seats/SeatAlertLayer'
import { InstallPrompt } from '@/components/InstallPrompt'
import { AdminActivityToaster } from '@/features/admin/AdminActivityToaster'
import { GettingStartedChecklist } from '@/features/getting-started/GettingStartedChecklist'
import { TourWelcomePrompt } from '@/features/getting-started/TourWelcomePrompt'
import { SurveyRewardPrompt } from '@/features/feedback/survey/SurveyRewardPrompt'
import { ProGiftCelebration } from '@/features/pro-gift/ProGiftCelebration'
import { SubscriptionCelebration } from '@/features/billing/SubscriptionCelebration'
import { EndOfTermPrompt } from '@/features/courses/EndOfTermPrompt'
import { Coachmark } from '@/features/getting-started/Coachmark'
import { TourProvider } from '@/features/tour/TourProvider'
import { TourOverlay } from '@/features/tour/TourOverlay'

/** Chrome for the authenticated student app context. Gated: the whole `/app`
 * area requires a signed-in session — otherwise the login screen takes over. */
export function StudentLayout({ children }: { children?: React.ReactNode } = {}) {
  const { user, loading } = useAuth()
  const { onboardingCompleted } = useAppData()
  const { pathname } = useLocation()

  /**
   * Community carries its own search bar, so the app's magnifier stands down
   * while you are in it.
   *
   * Two search doors on one screen — an icon in the top bar and a field
   * directly under it — is the thing that made this tab feel cluttered, and the
   * one you would reach for there is the one that searches people and clubs,
   * not the command palette. Everywhere else the palette is still the spine.
   */
  const communitySearchOwnsIt = pathname.startsWith('/app/community')

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
    <TourProvider>
    <div className="flex h-svh overflow-hidden bg-canvas">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: pad past the status bar / notch in standalone mode */}
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 pb-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] md:hidden">
          <Logo />
          <div className="flex shrink-0 items-center gap-1">
            {!communitySearchOwnsIt && <MobileSearchButton />}
            <AvatarMenu align="top" compact />
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto">
          {/* `children` for the one page that lives at a top-level URL but
              still belongs inside the app: a public profile at /@handle, which
              a signed-in student should see with their sidebar rather than as
              a stranger's page. */}
          {children ?? <Outlet />}
        </main>

        {/* In-flow at the bottom of the column (not fixed) so content fills exactly
            up to it: no viewport-math compensation, no gap. Hidden on desktop. */}
        <MobileNav />
      </div>

      <CommandPalette />
      <QuickActionLayer />
      <SettingsLayer />
      <SupportLayer />
      <UpdatesLayer />
      <ThemePreviewBar />
      <SurveyClaimLayer />
      <SeatAlertLayer />
      <InstallPrompt />
      <GettingStartedChecklist />
      <Coachmark
        id="add-course"
        selector='[data-coach="add-course"]'
        title="Start with a course"
        body="Add your first course: import a syllabus or pick a classmate's blueprint. Everything builds from here."
      />
      <Coachmark
        id="mark-done"
        selector='[data-coach="mark-done"]'
        title="Check it off"
        body="Tap the circle to mark a task done. Tap the row itself to edit its date, grade, or notes."
      />
      <TourOverlay />
      <TourWelcomePrompt />
      <SurveyRewardPrompt />
      {/* Rendered last → its portal sits on top, so a Pro gift greets the user
          before any other one-time prompt. */}
      <ProGiftCelebration />
      <SubscriptionCelebration />
      <EndOfTermPrompt />
      <AdminActivityToaster />
    </div>
    </TourProvider>
  )
}
