/** The founders — badged specially in the feedback board (cosmetic; matched by
 * public handle, with name fallbacks for the two accounts). Split out so the
 * feedback-ui module stays components-only (react-refresh). */
export function founderRole(handle?: string | null, name?: string | null): 'Founder' | 'Admin' | null {
  const h = (handle ?? '').replace(/^@/, '').toLowerCase()
  const n = (name ?? '').trim().toLowerCase()
  if (h === 'concordiatracker' || n === 'concordia tracker' || n === 'concordiatracker') return 'Admin'
  if (h === 'alexdegryse' || h === 'alexxdegryse' || n === 'alex degryse') return 'Founder'
  return null
}
