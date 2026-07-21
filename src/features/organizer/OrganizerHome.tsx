import { useState } from 'react'
import { useTeacher } from '@/app/providers/teacher'
import { OrganizerSignIn } from './OrganizerSignIn'
import { OrganizerOverview } from './OrganizerOverview'
import { OrgOnboardingGate } from './OrgOnboardingWizard'
import { resetOnboarding } from './onboarding-state'

/** `/organizer` — the sign-in door when signed out, the Overview page when signed
 * in. A fresh (pending) org gets the guided onboarding wizard on top; the
 * Overview "Replay setup" button re-runs it anytime (any org status). */
export function OrganizerHome() {
  const { currentOrg } = useTeacher()
  const [replay, setReplay] = useState(false)
  if (!currentOrg) return <OrganizerSignIn />
  const org = currentOrg
  return (
    <>
      <OrganizerOverview
        onReplaySetup={() => {
          resetOnboarding(org.id)
          setReplay(true)
        }}
      />
      <OrgOnboardingGate org={org} replay={replay} onReplayDone={() => setReplay(false)} />
    </>
  )
}
