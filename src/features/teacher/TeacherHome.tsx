import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useUiState } from '@/app/providers/ui-state'
import { useT } from '@/i18n/i18n'
import { TeacherSignIn } from './TeacherSignIn'
import { TeacherDashboard } from './TeacherDashboard'
import { TeacherOnboarding } from './onboarding/TeacherOnboarding'

/**
 * `/teacher`: the sign-in door when signed out, the dashboard when signed in,
 * and the setup wizard in front of it the first time a real teacher arrives.
 *
 * WHO GETS THE WIZARD: your own account, not finished or skipped before, and
 * no courses yet. The course check is what spares a teacher who was already
 * using the portal before the wizard existed. Demo and seeded teachers never
 * see it; they are a sandbox to look around.
 *
 * DECIDED ONCE, THEN HELD. Adding a course inside the wizard would otherwise
 * flip "no courses yet" and close it mid-flow, so the answer is taken the
 * first time both facts have loaded and kept until the wizard is closed.
 * Until then a spinner shows, not the dashboard: the club portal learned that
 * a dashboard flashing up behind setup reads as a glitch.
 */
export function TeacherHome() {
  const t = useT()
  const { currentTeacher, isSelfTeacher, coursesLoaded } = useTeacher()
  const { uiState, loaded, patchUiState } = useUiState()
  const [wizard, setWizard] = useState<'open' | 'closed' | null>(null)

  if (!currentTeacher) return <TeacherSignIn />
  if (!isSelfTeacher) return <TeacherDashboard />

  if (wizard === null && loaded && coursesLoaded) {
    setWizard(!uiState.teacherSetupDone && currentTeacher.courses.length === 0 ? 'open' : 'closed')
  }
  if (wizard === null) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label={t('teacherSetup.loading')} />
      </div>
    )
  }
  if (wizard === 'open') {
    return (
      <TeacherOnboarding
        teacher={currentTeacher}
        onClose={() => {
          patchUiState({ teacherSetupDone: true })
          setWizard('closed')
        }}
      />
    )
  }
  return <TeacherDashboard />
}
