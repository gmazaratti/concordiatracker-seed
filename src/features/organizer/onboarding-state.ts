/** In-memory onboarding state (resets on reload, like the rest of the portal's
 * demo world): which orgs finished/skipped setup, which step each one is on —
 * so it RESUMES rather than restarting — and which have already been asked who
 * is setting them up. Split from the components for react-refresh. */

export const onboarded = new Set<string>()
export const stepByOrg = new Map<string, number>()
/** Orgs whose "are you the president?" question has been answered. Asked once:
 *  replaying setup to look at it again should not re-ask who you are. */
export const roleAsked = new Set<string>()

/** Reset an org's saved position — call before opening a replay so it starts
 * from the first step. */
export function resetOnboarding(orgId: string) {
  stepByOrg.set(orgId, 0)
}
