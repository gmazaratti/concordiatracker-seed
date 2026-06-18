import { useTeacher } from '@/app/providers/teacher'
import { OrganizerSignIn } from './OrganizerSignIn'
import { OrganizerDashboard } from './OrganizerDashboard'

/** `/organizer` — the sign-in door when signed out, the dashboard when signed in. */
export function OrganizerHome() {
  const { currentOrg } = useTeacher()
  return currentOrg ? <OrganizerDashboard /> : <OrganizerSignIn />
}
