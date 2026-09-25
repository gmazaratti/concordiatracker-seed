/** Which setup step the teacher was on, so reopening the wizard resumes
 *  instead of restarting. In memory only, like the club wizard's `stepByOrg`:
 *  the finished flag (ui_state.teacherSetupDone) is what persists. Split from
 *  the component so it is not reassigned during render. */
export const teacherStep = new Map<'step', number>()
