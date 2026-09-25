import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppTitle } from '@/app/hooks/useAppTitle'
import { useScrollMemory } from '@/app/hooks/useScrollMemory'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MessageToast } from '@/features/profile/MessageToast'
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
import { WriteErrorToast } from '@/components/WriteErrorToast'
import { SupportLayer } from '@/features/support/SupportLayer'
import { NotificationToast } from '@/features/community/NotificationToast'
import { ActivityLayer } from '@/features/community/ActivityLayer'
import { markTabRendered } from '@/lib/view-transition'
import { LiveMessages } from '@/features/profile/LiveMessages'
import { ThemePreviewBar } from '@/components/ThemePreviewBar'
import { UpdatesLayer } from '@/features/updates/UpdatesLayer'
import { SeatAlertLayer } from '@/features/seats/SeatAlertLayer'
import { AdminMessageLayer } from '@/features/messages/AdminMessageLayer'
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
  const { onboardingCompleted, courses, pastCourses } = useAppData()
  const { pathname } = useLocation()
  // A tab animates only once its (lazy) page has rendered: lib/view-transition.
  useEffect(() => {
    markTabRendered(pathname)
  }, [pathname])
  // Before the early returns: a hook is a hook. It writes nothing
  // outside /app, so the login screen and a public profile keep their
  // own titles.
  useAppTitle()
  /* THE ONE SCROLLER IN THE APP, so this is the one place that can remember
     where each page was left. */
  const scroller = useRef<HTMLElement>(null)
  useScrollMemory(scroller)

  /**
   * A PROFILE OWNS THE WHOLE SCREEN, and so does Community.
   *
   * The app bar puts the wordmark on the left and your own avatar on the
   * right. Above a profile that is two of the same face, one of them a control
   * that goes nowhere useful from here. Above Community it is worse: a second
   * navigation stacked on a tab that already carries its own search, its own
   * sections and your own profile, which is the clutter this tab was rebuilt
   * to remove. Both render what they need themselves.
   */
  const ownsTheWholeScreen =
    pathname.startsWith('/@') || pathname.startsWith('/app/community')

  // First-login onboarding gate. Wait for the profile to load (null) so a
  // returning, already-onboarded user never flashes the app before redirecting.
  if (loading || (user && onboardingCompleted === null)) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (!user) return <LoginScreen />
  if (onboardingCompleted === false) return <Navigate to="/onboarding" replace />

  return (
    <TourProvider>
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: pad past the status bar / notch in standalone mode */}
        {!ownsTheWholeScreen && (
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 pb-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] md:hidden">
            <Logo />
            <div className="flex shrink-0 items-center gap-1">
              <MobileSearchButton />
              <AvatarMenu align="top" compact />
            </div>
          </header>
        )}

        {/* The in-app message banner. On the shell, above <main>, because a
            message can arrive on any screen and it must not scroll with the
            one you happen to be on. */}
        <MessageToast />

        <main ref={scroller} id="app-main" className="relative flex-1 overflow-y-auto">
          {/* `children` for the one page that lives at a top-level URL but
              still belongs inside the app: a public profile at /@handle, which
              a signed-in student should see with their sidebar rather than as
              a stranger's page. */}
          {/* THE LAST LINE OF DEFENCE. A render that throws anywhere under
              here used to unmount the ENTIRE app — no sidebar, no tabs, no way
              back, just a grey screen you had to restart out of. Now the shell
              survives and the screen says so. */}
          <ErrorBoundary variant="page" resetKey={pathname}>
            {children ?? <Outlet />}
          </ErrorBoundary>
        </main>

        {/* In-flow at the bottom of the column (not fixed) so content fills exactly
            up to it: no viewport-math compensation, no gap. Hidden on desktop. */}
        <MobileNav />
      </div>

      <CommandPalette />
      <QuickActionLayer />
      <SettingsLayer />
      {/* A background save that failed says so — see lib/write-errors.ts. */}
      <WriteErrorToast />
      <SupportLayer />
      {/* Mounted on the shell, not in Community: the point is that it finds
          you on whatever page you land on. */}
      <NotificationToast />
      <ActivityLayer />
      {/* One inbox subscription for the whole app: a message can land while
          you are anywhere, and the list that cares is usually not on screen. */}
      <LiveMessages />
      <UpdatesLayer />
      <ThemePreviewBar />
      <SurveyClaimLayer />
      <SeatAlertLayer />
      <AdminMessageLayer />
      <InstallPrompt />
      <GettingStartedChecklist />
      <Coachmark
        id="add-course"
        selector='[data-coach="add-course"]'
        title="Start with a course"
        when={courses.length + pastCourses.length === 0}
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
