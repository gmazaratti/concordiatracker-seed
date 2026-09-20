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

/**
 * The feed itself: what the orgs have posted lately.
 *
 * Ordered by WHEN IT WAS POSTED, not when it happens — that is the difference
 * between a feed and a calendar, and the calendar already exists two tabs over.
 * Orgs you follow come first, because following something and then not seeing
 * it is the one outcome that makes the button pointless; everything else
 * follows underneath so the feed is never empty for a new account.
 *
 * A recurring night appears once. Four copies of the same party is what a feed
 * looks like when nobody thought about it.
 */
export function feedPosts(
  events: CampusEvent[],
  isFollowing: (handle: string) => boolean,
  limit = 12,
): { event: CampusEvent; followed: boolean }[] {
  const now = Date.now()
  const seen = new Set<string>()
  return events
    .filter((e) => new Date(e.start).getTime() >= now)
    .filter((e) => {
      if (!e.seriesId) return true
      if (seen.has(e.seriesId)) return false
      seen.add(e.seriesId)
      return true
    })
    .map((e) => ({ event: e, followed: isFollowing(e.org.handle) }))
    .sort((a, b) => {
      if (a.followed !== b.followed) return a.followed ? -1 : 1
      return a.event.postedDaysAgo - b.event.postedDaysAgo
    })
    .slice(0, limit)
}
