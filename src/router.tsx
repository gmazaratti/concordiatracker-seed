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
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TeacherPage } from '@/features/teacher/TeacherPage'
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
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Teacher portal context */}
      <Route path="/teacher" element={<TeacherLayout />}>
        <Route index element={<TeacherPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
