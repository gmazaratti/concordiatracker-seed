import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { StudentLayout } from '@/layouts/StudentLayout'
import { PortalLayout } from '@/layouts/TeacherLayout'
import { LandingPage } from '@/features/landing/LandingPage'
import { ConcordiaGpaCalculatorPage, ConcordiaSyllabusTrackerPage } from '@/features/landing/SeoLandingPages'
import { TodayPage } from '@/features/today/TodayPage'
import { CoursesPage } from '@/features/courses/CoursesPage'
import { CourseDetailPage } from '@/features/courses/CourseDetailPage'
import { BlueprintBrowserPage } from '@/features/courses/BlueprintBrowserPage'
import { SyllabusUploadPage } from '@/features/courses/SyllabusUpload'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { CommunityPage } from '@/features/community/CommunityPage'
import { OrgProfilePage } from '@/features/community/OrgProfilePage'
import { PublicEventPage } from '@/features/community/PublicEventPage'
import { TeacherHome } from '@/features/teacher/TeacherHome'
import { TeacherInvitePage } from '@/features/teacher/TeacherInvitePage'
import { TeacherRequestPage } from '@/features/teacher/TeacherRequestPage'
import { TeacherCourseWorkspace } from '@/features/teacher/TeacherCourseWorkspace'
import { AdminConsole } from '@/features/admin/AdminConsole'
import { FeedbackPage } from '@/features/feedback/FeedbackPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { OrganizerHome } from '@/features/organizer/OrganizerHome'
import { OrganizerEventEditor } from '@/features/organizer/OrganizerEventEditor'
import { OrgProfileEditor } from '@/features/organizer/OrgProfileEditor'
import { OrganizerTeam } from '@/features/organizer/OrganizerTeam'
import { OrganizerInvitePage } from '@/features/organizer/OrganizerInvitePage'
import { OrgMemberInvitePage } from '@/features/organizer/OrgMemberInvitePage'
import { LegalPage } from '@/features/legal/LegalPage'
import { DemoReel } from '@/features/demo/DemoReel'
import { UserProfilePage } from '@/features/profile/UserProfilePage'
import { NotFoundPage } from '@/features/NotFoundPage'

/** Route tree for the three contexts: public, student app, teacher portal. */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing context */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
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
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/org/:handle" element={<OrgProfilePage />} />
      </Route>

      {/* Teacher portal context — a separate, invite-based auth context */}
      <Route path="/teacher" element={<PortalLayout role="teacher" />}>
        <Route index element={<TeacherHome />} />
        <Route path="invite/:token" element={<TeacherInvitePage />} />
        <Route path="request" element={<TeacherRequestPage role="teacher" />} />
        <Route path="course/:courseId" element={<TeacherCourseWorkspace />} />
      </Route>

      {/* Organizer portal context — same shell, organizer role (Community events) */}
      <Route path="/organizer" element={<PortalLayout role="organizer" />}>
        <Route index element={<OrganizerHome />} />
        <Route path="invite/:token" element={<OrganizerInvitePage />} />
        <Route path="join/:token" element={<OrgMemberInvitePage />} />
        <Route path="request" element={<TeacherRequestPage role="organizer" />} />
        <Route path="event/:eventId" element={<OrganizerEventEditor />} />
        <Route path="profile" element={<OrgProfileEditor />} />
        <Route path="team" element={<OrganizerTeam />} />
      </Route>

      {/* Admin console — STANDALONE, admin-only. Gated three ways: the menu entry
          is hidden for non-admins, this page shows "Not authorized" to non-admins,
          and every underlying RPC is denied at the database unless is_admin(). */}
      <Route path="/admin" element={<AdminConsole />} />

      {/* Feedback — feature-request board + private bug submission. Reached from the
          avatar menu and Today; not a sidebar tab. */}
      <Route path="/feedback" element={<FeedbackPage />} />

      {/* First-login student onboarding (full-screen). The /app gate redirects
          un-onboarded users here. */}
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Standalone legal documents — clean top-level URLs + a /legal/:doc form */}
      <Route path="/terms" element={<LegalPage doc="terms" />} />
      <Route path="/privacy" element={<LegalPage doc="privacy" />} />
      <Route path="/privacypolicy" element={<LegalPage doc="privacy" />} />
      <Route path="/educator" element={<LegalPage doc="educator" />} />
      <Route path="/legal/:doc" element={<LegalPage />} />

      {/* Public, shareable event page — viewable without an account */}
      <Route path="/e/:eventId" element={<PublicEventPage />} />

      {/* Throwaway full-bleed promo reel for screen recording — not in app nav */}
      <Route path="/demo" element={<DemoReel />} />

      {/* Public user profile — concordiatracker.com/@handle (anyone can view).
          Dynamic single-segment, so every static route above wins; the component
          requires the leading "@" and 404s otherwise. Keep last (before *). */}
      <Route path="/:handle" element={<UserProfilePage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
