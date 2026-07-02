import { useTeacher } from '@/app/providers/teacher'
import { OrganizerSignIn } from './OrganizerSignIn'
import { OrganizerOverview } from './OrganizerOverview'
import { OrgOnboardingGate } from './OrgOnboardingWizard'

/** `/organizer` — the sign-in door when signed out, the Overview page when signed
 * in. A fresh (pending) org gets the guided onboarding wizard on top. */
export function OrganizerHome() {
  const { currentOrg } = useTeacher()
  if (!currentOrg) return <OrganizerSignIn />
  return (
    <>
      <OrganizerOverview />
      <OrgOnboardingGate org={currentOrg} />
    </>
  )
}
