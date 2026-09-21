import type { CampusEvent, EventOrg } from '@/data/community'

const DAY = 86_400_000

/* Selection logic lives here, out of the components, for two reasons: the
 * render path has to stay pure (these read the clock), and the rail and the
 * feed were about to grow two subtly different answers to the same question. */

/** Upcoming events inside the next 7 days, soonest first. */
export function eventsThisWeek(events: CampusEvent[], limit = 5): CampusEvent[] {
  const now = Date.now()
  return events
    .filter((e) => {
      const t = new Date(e.start).getTime()
      return t >= now && t <= now + 7 * DAY
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, limit)
}

/** Orgs the student doesn't follow yet, ranked by upcoming activity — a dead
 * org is a poor suggestion, so only ones with something coming up qualify. */
export function suggestOrgs(
  orgs: EventOrg[],
  events: CampusEvent[],
  isFollowing: (handle: string) => boolean,
  limit = 4,
): EventOrg[] {
  const now = Date.now()
  const upcoming = new Map<string, number>()
  for (const e of events) {
    if (new Date(e.start).getTime() < now) continue
    upcoming.set(e.org.handle, (upcoming.get(e.org.handle) ?? 0) + 1)
  }
  return orgs
    .filter((o) => !isFollowing(o.handle) && (upcoming.get(o.handle) ?? 0) > 0)
    .sort((a, b) => (upcoming.get(b.handle) ?? 0) - (upcoming.get(a.handle) ?? 0))
    .slice(0, limit)
}
