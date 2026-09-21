import { FOUNDERS } from './founders'

/**
 * Who carries a seal, and what colour it is.
 *
 * ONE SOURCE, because the badge appears in five places — the profile page, the
 * chat header, the DM list, search results and the sidebar footer — and five
 * copies of "is this person staff" is five chances for the founder to be
 * verified in one of them and not the others. Which is exactly what happened:
 * @alex had a seal and @concordiatracker did not.
 *
 * THE COLOURS MEAN DIFFERENT THINGS, and that is the point of having more than
 * one. Blue is the one students already read as "a real organisation" on club
 * accounts. Green is us. Amber is somebody who runs a club — useful precisely
 * because it is NOT the same as the club's own badge: the person is not the
 * organisation, and a student should be able to tell a president from the
 * account they post under.
 *
 * STAFF IS A CLOSED SET, hardcoded and not grantable. ORGANIZER IS DERIVED
 * from owning an approved organisation, so it appears and disappears on its
 * own and nobody has to remember to revoke it.
 */
export type BadgeKind = 'staff' | 'org' | 'organizer'

export interface Badge {
  kind: BadgeKind
  /** Shown under the name where there is room for it. */
  role: string
  /** Tailwind text colour for the seal. */
  tone: string
  /** For the `aria-label`, so the colour is not the only thing carrying it. */
  label: string
}

const STAFF_TONE = 'text-success'
const ORG_TONE = 'text-info'
const ORGANIZER_TONE = 'text-warning'

/**
 * The badge for a person, or undefined.
 *
 * `orgName` is the approved organisation they own, if any — passed in rather
 * than fetched so this stays pure and every caller can use whatever it already
 * has loaded.
 */
export function badgeForPerson(
  handle: string | null | undefined,
  orgName?: string | null,
): Badge | undefined {
  const staff = handle ? FOUNDERS[handle.toLowerCase()] : undefined
  // Staff wins over organizer: if the founder also runs a club, the thing a
  // student needs to know first is that this account is us.
  if (staff) {
    return { kind: 'staff', role: staff.role, tone: STAFF_TONE, label: `${staff.role} · ConcordiaTracker` }
  }
  if (orgName) {
    return { kind: 'organizer', role: 'Organizer', tone: ORGANIZER_TONE, label: `Organizer · ${orgName}` }
  }
  return undefined
}

/** An organisation's own seal — the blue one students already know. */
export const ORG_BADGE: Badge = {
  kind: 'org',
  role: 'Verified',
  tone: ORG_TONE,
  label: 'Verified org',
}
