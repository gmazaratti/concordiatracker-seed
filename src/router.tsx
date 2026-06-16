import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { StudentLayout } from '@/layouts/StudentLayout'
import { TeacherLayout } from '@/layouts/TeacherLayout'
import { LandingPage } from '@/features/landing/LandingPage'
import { TodayPage } from '@/features/today/TodayPage'
import { CoursesPage } from '@/features/courses/CoursesPage'
import { CourseDetailPage } from '@/features/courses/CourseDetailPage'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { CommunityPage } from '@/features/community/CommunityPage'
import { TeacherPage } from '@/features/teacher/TeacherPage'
import { LegalPage } from '@/features/legal/LegalPage'
import { NotFoundPage } from '@/features/NotFoundPage'

/** Route tree for the three contexts: public, student app, teacher portal. */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing context */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
      </Route>

      {/* Student app context */}
      <Route path="/app" element={<StudentLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:courseId" element={<CourseDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="community" element={<CommunityPage />} />
      </Route>

      {/* Teacher portal context */}
      <Route path="/teacher" element={<TeacherLayout />}>
        <Route index element={<TeacherPage />} />
      </Route>

      {/* Standalone legal documents — clean top-level URLs + a /legal/:doc form */}
      <Route path="/terms" element={<LegalPage doc="terms" />} />
      <Route path="/privacy" element={<LegalPage doc="privacy" />} />
      <Route path="/privacypolicy" element={<LegalPage doc="privacy" />} />
      <Route path="/educator" element={<LegalPage doc="educator" />} />
      <Route path="/legal/:doc" element={<LegalPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
