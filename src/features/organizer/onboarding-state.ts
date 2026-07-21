/** In-memory onboarding-wizard state (resets on reload, like the rest of the
 * portal's demo world): which orgs finished/skipped the wizard, and the step
 * each org is on — so it RESUMES after you leave to do a step. Split from the
 * wizard component for react-refresh (components-only exports). */

export const onboarded = new Set<string>()
export const stepByOrg = new Map<string, number>()

/** Reset an org's saved wizard position — call before opening a replay so it
 * starts from the first step. */
export function resetOnboarding(orgId: string) {
  stepByOrg.set(orgId, 0)
}
