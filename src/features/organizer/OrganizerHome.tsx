import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { useTeacher } from '@/app/providers/teacher'
import { fireWrite, supabase } from '@/lib/supabase'
import { OrganizerSignIn } from './OrganizerSignIn'
import { OrganizerOverview } from './OrganizerOverview'
import { OrgOnboardingGate } from './onboarding/OrgOnboarding'
import { resetOnboarding } from './onboarding-state'

/**
 * `/organizer` — the sign-in door when signed out, the Overview when signed in,
 * with the setup wizard over the top of a club that has not been through it.
 *
 * `?org=<id>` NAMES WHICH CLUB, and it has to, because accepting an invite is
 * a full page load: the in-memory session does not survive it, and an admin
 * has every organisation in the switcher — so without the id the portal opened
 * on whichever one sorted first. That is how accepting an invite for a new
 * club landed on Office of the President.
 *
 * IT WAITS FOR THE LIST. `myOrgs` starts empty and fills two queries later, so
 * anything that decides on `!currentOrg` decides on the first render, before
 * the answer exists.
 */
export function OrganizerHome() {
  const { currentOrg, myOrgs, orgsLoading, switchOrg, ownedOrgIds } = useTeacher()
  const { user: authUser } = useAuth()
  const [params] = useSearchParams()
  const wanted = params.get('org')
  const [replay, setReplay] = useState(false)

  useEffect(() => {
    if (orgsLoading || !wanted || currentOrg?.id === wanted) return
    if (myOrgs.some((o) => o.id === wanted)) switchOrg(wanted)
  }, [orgsLoading, wanted, currentOrg, myOrgs, switchOrg])

  if (orgsLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (!currentOrg) return <OrganizerSignIn />
  const org = currentOrg
  return (
    <>
      <OrganizerOverview
        onReplaySetup={() => {
          resetOnboarding(org.id)
          // Re-opened in the database as well, so a reload mid-replay does not
          // slam it shut — `replay` alone is session state.
          fireWrite(supabase.rpc('reset_org_setup', { p_org: org.id }))
          setReplay(true)
        }}
      />
      {/* ONLY FOR THE TEAM. A platform admin can open any club, including one
          built for somebody else and not yet claimed — its setup wizard is
          for whoever claims it, not for the admin filling it in. */}
      {(ownedOrgIds.has(org.id) || org.members.some((m) => !!authUser && m.userId === authUser.id) || replay) && (
        <OrgOnboardingGate org={org} replay={replay} onReplayDone={() => setReplay(false)} />
      )}
    </>
  )
}
