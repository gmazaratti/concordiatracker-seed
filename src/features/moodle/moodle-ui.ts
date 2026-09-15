/**
 * Small helpers shared by the Moodle screens.
 *
 * Their own file because a .tsx that exports a component AND a function loses
 * fast refresh (`react-refresh/only-export-components`) — the same reason
 * `SOCIAL_FIELDS` was split out of `SocialLinks.tsx`.
 */

/** Where the link lives in Moodle. One constant, so the guide, the docs link
 *  and the onboarding step cannot point at three different pages. */
export const MOODLE_EXPORT_URL = 'https://moodle.concordia.ca/moodle/calendar/export.php'

/** "3 hours ago" without pulling a date library in for one string. */
export function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const min = Math.round(ms / 60_000)
  if (min < 2) return 'just now'
  if (min < 60) return `${min} minutes ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`
  const d = Math.round(hr / 24)
  return `${d} ${d === 1 ? 'day' : 'days'} ago`
}
