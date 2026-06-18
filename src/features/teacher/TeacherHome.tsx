import { useTeacher } from '@/app/providers/teacher'
import { TeacherSignIn } from './TeacherSignIn'
import { TeacherDashboard } from './TeacherDashboard'

/** `/teacher` — the sign-in door when signed out, the dashboard when signed in. */
export function TeacherHome() {
  const { currentTeacher } = useTeacher()
  return currentTeacher ? <TeacherDashboard /> : <TeacherSignIn />
}
