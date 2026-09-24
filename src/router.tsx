import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { StudentLayout } from '@/layouts/StudentLayout'
import { PortalLayout } from '@/layouts/TeacherLayout'
import { OrganizerLayout } from '@/layouts/OrganizerLayout'
import { RecordlyPage } from '@/features/dev-landing-2/RecordlyPage'
import { RefLanding } from '@/features/landing/RefLanding'
import { TodayPage } from '@/features/today/TodayPage'
import { NotFoundPage } from '@/features/NotFoundPage'
import { Loader2 } from 'lucide-react'

/**
 * EVERY ROUTE BUT TWO IS CODE-SPLIT.
 *
 * The app shipped as one 1.9 MB chunk (505 KB gzipped) and every visitor paid
 * for all of it — a student opening Today downloaded the organizer portal, the
 * admin console, the prerequisite graph and the marketing demo reel before
 * seeing their own deadlines. Vercel Speed Insights put the Real Experience
 * Score at 48 ("Poor"), which is what that looks like from a phone.
 *
 * `lazy()` turns each of these into its own chunk, fetched when the route is
 * actually visited.
 *
 * TWO STAY EAGER, on purpose: the landing page and Today are the first paint
 * for the two kinds of arrival (a visitor and a signed-in student), and making
 * either wait on a second request to show anything would move the cost rather
 * than remove it.
 */
const ConcordiaGpaCalculatorPage = lazy(() => import('@/features/landing/SeoLandingPages').then((x) => ({ default: x.ConcordiaGpaCalculatorPage })))
const ConcordiaSyllabusTrackerPage = lazy(() => import('@/features/landing/SeoLandingPages').then((x) => ({ default: x.ConcordiaSyllabusTrackerPage })))
const CoursesPage = lazy(() => import('@/features/courses/CoursesPage').then((x) => ({ default: x.CoursesPage })))
const CourseDetailPage = lazy(() => import('@/features/courses/CourseDetailPage').then((x) => ({ default: x.CourseDetailPage })))
const BlueprintBrowserPage = lazy(() => import('@/features/courses/BlueprintBrowserPage').then((x) => ({ default: x.BlueprintBrowserPage })))
const SyllabusUploadPage = lazy(() => import('@/features/courses/SyllabusUpload').then((x) => ({ default: x.SyllabusUploadPage })))
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage').then((x) => ({ default: x.CalendarPage })))
const PlannerPage = lazy(() => import('@/features/planner/PlannerPage').then((x) => ({ default: x.PlannerPage })))
const CommunityPage = lazy(() => import('@/features/community/CommunityPage').then((x) => ({ default: x.CommunityPage })))
const FollowingPage = lazy(() => import('@/features/community/FollowingPage').then((x) => ({ default: x.FollowingPage })))
const NotificationsPage = lazy(() => import('@/features/community/NotificationsPage').then((x) => ({ default: x.NotificationsPage })))
const OrgProfilePage = lazy(() => import('@/features/community/OrgProfilePage').then((x) => ({ default: x.OrgProfilePage })))
const PublicEventPage = lazy(() => import('@/features/community/PublicEventPage').then((x) => ({ default: x.PublicEventPage })))
const SharedSchedulePage = lazy(() => import('@/features/planner/SharedSchedulePage').then((x) => ({ default: x.SharedSchedulePage })))
const TeacherHome = lazy(() => import('@/features/teacher/TeacherHome').then((x) => ({ default: x.TeacherHome })))
const TeacherInvitePage = lazy(() => import('@/features/teacher/TeacherInvitePage').then((x) => ({ default: x.TeacherInvitePage })))
const TeacherRequestPage = lazy(() => import('@/features/teacher/TeacherRequestPage').then((x) => ({ default: x.TeacherRequestPage })))
const TeacherCourseWorkspace = lazy(() => import('@/features/teacher/TeacherCourseWorkspace').then((x) => ({ default: x.TeacherCourseWorkspace })))
const AdminConsole = lazy(() => import('@/features/admin/AdminConsole').then((x) => ({ default: x.AdminConsole })))
const FeedbackPage = lazy(() => import('@/features/feedback/FeedbackPage').then((x) => ({ default: x.FeedbackPage })))
const PublicSurveyPage = lazy(() => import('@/features/survey/PublicSurveyPage').then((x) => ({ default: x.PublicSurveyPage })))
const AppRequestsPage = lazy(() => import('@/features/feedback/AppRequestsPage').then((x) => ({ default: x.AppRequestsPage })))
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage').then((x) => ({ default: x.OnboardingPage })))
const OrganizerHome = lazy(() => import('@/features/organizer/OrganizerHome').then((x) => ({ default: x.OrganizerHome })))
const OrganizerEvents = lazy(() => import('@/features/organizer/OrganizerEvents').then((x) => ({ default: x.OrganizerEvents })))
const OrganizerInbox = lazy(() => import('@/features/organizer/OrganizerInbox').then((x) => ({ default: x.OrganizerInbox })))
const OrganizerCollabs = lazy(() => import('@/features/organizer/OrganizerCollabs').then((x) => ({ default: x.OrganizerCollabs })))
const OrganizerInsights = lazy(() => import('@/features/organizer/OrganizerInsights').then((x) => ({ default: x.OrganizerInsights })))
const OrganizerEventEditor = lazy(() => import('@/features/organizer/OrganizerEventEditor').then((x) => ({ default: x.OrganizerEventEditor })))
const OrgProfileEditor = lazy(() => import('@/features/organizer/OrgProfileEditor').then((x) => ({ default: x.OrgProfileEditor })))
const OrganizerTeam = lazy(() => import('@/features/organizer/OrganizerTeam').then((x) => ({ default: x.OrganizerTeam })))
const OrganizerFeed = lazy(() => import('@/features/organizer/OrganizerFeed').then((x) => ({ default: x.OrganizerFeed })))
const OrganizerRoles = lazy(() => import('@/features/organizer/OrganizerRoles').then((x) => ({ default: x.OrganizerRoles })))
const OrganizerActivity = lazy(() => import('@/features/organizer/OrganizerActivity').then((x) => ({ default: x.OrganizerActivity })))
const OrganizerInvitePage = lazy(() => import('@/features/organizer/OrganizerInvitePage').then((x) => ({ default: x.OrganizerInvitePage })))
const OrgMemberInvitePage = lazy(() => import('@/features/organizer/OrgMemberInvitePage').then((x) => ({ default: x.OrgMemberInvitePage })))
const OrganizerApplyPage = lazy(() => import('@/features/organizer/OrganizerApplyPage').then((x) => ({ default: x.OrganizerApplyPage })))
const LegalPage = lazy(() => import('@/features/legal/LegalPage').then((x) => ({ default: x.LegalPage })))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage').then((x) => ({ default: x.ResetPasswordPage })))
const DemoReel = lazy(() => import('@/features/demo/DemoReel').then((x) => ({ default: x.DemoReel })))
const OriginalLanding = lazy(() => import('@/features/landing/OriginalLanding').then((x) => ({ default: x.OriginalLanding })))
const DevLandingPage = lazy(() => import('@/features/dev-landing/DevLandingPage').then((x) => ({ default: x.DevLandingPage })))
const DevLoginPage = lazy(() => import('@/features/dev-login/DevLoginPage').then((x) => ({ default: x.DevLoginPage })))
const UserProfilePage = lazy(() => import('@/features/profile/UserProfilePage').then((x) => ({ default: x.UserProfilePage })))

/** Route tree for the three contexts: public, student app, teacher portal. */
export function AppRoutes() {
  return (
    /* One boundary around the whole tree: a route-level chunk arrives in
       milliseconds on a warm connection, and a spinner per route would flash
       more than it reassures. */
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* The homepage. It brings its own header and footer, so it sits outside
          PublicLayout. /r is the same page, attributed: it sets a Reddit
          cookie, noindex, canonical to /. */}
      <Route index element={<RecordlyPage />} />
      <Route path="/r" element={<RefLanding source="reddit" />} />

      {/* Public marketing context */}
      <Route element={<PublicLayout />}>
        {/* The previous homepage, kept as a rollback: noindex, nofollow. */}
        <Route path="dev/original-landing" element={<OriginalLanding />} />
        <Route path="concordia-gpa-calculator" element={<ConcordiaGpaCalculatorPage />} />
        <Route path="concordia-syllabus-tracker" element={<ConcordiaSyllabusTrackerPage />} />
      </Route>

      {/* Student app context */}
      <Route path="/app" element={<StudentLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/blueprints" element={<BlueprintBrowserPage />} />
        <Route path="courses/upload" element={<SyllabusUploadPage />} />
        <Route path="courses/:courseId" element={<CourseDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="planner" element={<PlannerPage />} />
        {/* Both folded into Planner. Kept as redirects so anything already
            pointing here — the Today widget, a bookmark — still lands right. */}
        <Route path="radar" element={<Navigate to="/app/planner?tab=radar" replace />} />
        <Route path="money" element={<Navigate to="/app/planner?tab=money" replace />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/following" element={<FollowingPage />} />
        <Route path="community/notifications" element={<NotificationsPage />} />
        <Route path="community/org/:handle" element={<OrgProfilePage />} />
        {/* People moved into Community. Kept so older links and the sidebar
            entry that used to point here still land somewhere sensible. */}
        <Route path="people" element={<Navigate to="/app/community?c=messages" replace />} />
        <Route path="requests" element={<AppRequestsPage />} />
      </Route>

      {/* Teacher portal context: a separate, invite-based auth context */}
      <Route path="/teacher" element={<PortalLayout role="teacher" />}>
        <Route index element={<TeacherHome />} />
        <Route path="invite/:token" element={<TeacherInvitePage />} />
        <Route path="request" element={<TeacherRequestPage role="teacher" />} />
        <Route path="course/:courseId" element={<TeacherCourseWorkspace />} />
      </Route>

      {/* Organizer portal context: its own app-like shell (sidebar + pages) */}
      <Route path="/organizer" element={<OrganizerLayout />}>
        <Route index element={<OrganizerHome />} />
        <Route path="events" element={<OrganizerEvents />} />
        <Route path="inbox" element={<OrganizerInbox />} />
        <Route path="collabs" element={<OrganizerCollabs />} />
        <Route path="insights" element={<OrganizerInsights />} />
        <Route path="invite/:token" element={<OrganizerInvitePage />} />
        <Route path="join/:token" element={<OrgMemberInvitePage />} />
        <Route path="request" element={<TeacherRequestPage role="organizer" />} />
        {/* The club application at a linkable address (the landing FAQ points here). */}
        <Route path="apply" element={<OrganizerApplyPage />} />
        <Route path="event/:eventId" element={<OrganizerEventEditor />} />
        {/* There is ONE onboarding now and it lives over the dashboard, so
            this old address just goes there — keeping any `?org=` with it,
            which is what says WHICH club was just accepted. */}
        <Route path="setup" element={<SetupRedirect />} />
        <Route path="profile" element={<OrgProfileEditor />} />
        <Route path="team" element={<OrganizerTeam />} />
        <Route path="feed" element={<OrganizerFeed />} />
        <Route path="roles" element={<OrganizerRoles />} />
        <Route path="activity" element={<OrganizerActivity />} />
      </Route>

      {/*
        ALIASES FOR THE ONE LINK WE HAND OUT. /organizer is the real route and
        the plural is what half of everyone types — before an outreach wave
        that is not a typo, it is a share of the campaign landing on a 404.
        "orgs" and "clubs" are the other two people reach for.
      */}
      <Route path="/organizers" element={<Navigate to="/organizer" replace />} />
      <Route path="/orgs" element={<Navigate to="/organizer" replace />} />
      <Route path="/clubs" element={<Navigate to="/organizer" replace />} />

      {/* Short organizer invite links (email-friendly): /join/<token>: same
          accept page as /organizer/invite/<token>, slimmer URL. */}
      <Route path="/join" element={<OrganizerLayout />}>
        <Route path=":token" element={<OrganizerInvitePage />} />
      </Route>

      {/* Admin console: STANDALONE, admin-only. Gated three ways: the menu entry
          is hidden for non-admins, this page shows "Not authorized" to non-admins,
          and every underlying RPC is denied at the database unless is_admin(). */}
      <Route path="/admin" element={<AdminConsole />} />

      {/* Feedback: feature-request board + private bug submission. Reached from the
          avatar menu and Today; not a sidebar tab. */}
      <Route path="/feedback" element={<FeedbackPage />} />

      {/* Public market-research survey: shareable, works signed-out. */}
      <Route path="/survey" element={<PublicSurveyPage />} />

      {/* First-login student onboarding (full-screen). The /app gate redirects
          un-onboarded users here. */}
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Standalone legal documents: clean top-level URLs + a /legal/:doc form */}
      <Route path="/terms" element={<LegalPage doc="terms" />} />
      <Route path="/privacy" element={<LegalPage doc="privacy" />} />
      <Route path="/privacypolicy" element={<LegalPage doc="privacy" />} />
      <Route path="/educator" element={<LegalPage doc="educator" />} />
      <Route path="/legal/:doc" element={<LegalPage />} />

      {/* Public, shareable event page: viewable without an account */}
      <Route path="/e/:eventId" element={<PublicEventPage />} />

      {/* Public, shareable schedule. Signed-out on purpose: the whole point is
          sending it to a friend, and a login wall would kill that. */}
      <Route path="/s/:token" element={<SharedSchedulePage />} />

      {/* Where a password-reset email lands. Signed in by the link itself. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Throwaway full-bleed promo reel for screen recording: not in app nav */}
      <Route path="/demo" element={<DemoReel />} />

      {/* Hidden design drafts: not linked from the live site, noindex while
          mounted, and disallowed in robots.txt. */}
      <Route path="/dev/landing" element={<DevLandingPage />} />
      {/* The comp that became the homepage. Vercel answers a 301 to / for this
          path; this covers the dev server and in-app navigation. */}
      <Route path="/dev/landing/2" element={<Navigate to="/" replace />} />
      <Route path="/dev/login" element={<DevLoginPage />} />

      {/* Public user profile: concordiatracker.com/@handle (anyone can view).
          Dynamic single-segment, so every static route above wins; the component
          requires the leading "@" and 404s otherwise. Keep last (before *). */}
      <Route path="/:handle" element={<UserProfilePage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  )
}

/** Deliberately quiet: this shows for a few hundred milliseconds at most, and
 *  a skeleton of a page we have not loaded yet would be a guess at its shape. */
function RouteFallback() {
  return (
    <div className="grid min-h-svh place-items-center bg-canvas">
      <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
    </div>
  )
}

/** `/organizer/setup` was the old second onboarding. It is one flow now, on
 *  the dashboard — so this forwards, query string and all, because `?org=`
 *  is what names the club an invite just created. */
function SetupRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/organizer${search}`} replace />
}
