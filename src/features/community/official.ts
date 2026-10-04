/**
 * Official Concordia accounts: the university itself, its faculties and
 * offices, and the student union. Their verified seal is Concordia maroon
 * instead of the blue every other verified club gets, so a student can tell
 * "this is the university speaking" from "this is a club we checked".
 *
 * Keyed by handle because every surface that draws a seal (feed posts, story
 * rings, event tiles, search rows) already carries one, and none carries an id.
 * These accounts have no owner, so only an admin can rename one; if one is
 * ever renamed, update it here or its seal falls back to blue (and the old
 * handle would be free for anyone to claim).
 */
export const OFFICIAL_ORG_HANDLES: ReadonlySet<string> = new Set([
  '@concordia',
  '@concordia.president',
  '@concordia.library',
  '@concordia.hub',
  '@jmsb',
  '@ginacody',
  '@conu.caps',
])

export const OFFICIAL_TONE = 'text-[#912338]'

export function isOfficialOrg(handle: string | null | undefined): boolean {
  if (!handle) return false
  const h = handle.trim().toLowerCase()
  return OFFICIAL_ORG_HANDLES.has(h.startsWith('@') ? h : `@${h}`)
}
