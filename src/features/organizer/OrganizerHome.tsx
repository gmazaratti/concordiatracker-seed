import { useTeacher } from '@/app/providers/teacher'
import { OrganizerSignIn } from './OrganizerSignIn'
import { OrganizerDashboard } from './OrganizerDashboard'
import { OrgOnboardingGate } from './OrgOnboardingWizard'

/** `/organizer` — the sign-in door when signed out, the dashboard when signed in.
 * A fresh (pending) org gets the guided onboarding wizard once on top. */
export function OrganizerHome() {
  const { currentOrg } = useTeacher()
  if (!currentOrg) return <OrganizerSignIn />
  return (
    <>
      <OrganizerDashboard />
      <OrgOnboardingGate org={currentOrg} />
    </>
  )
}
