import { useMemo } from 'react'
import { useTeacher } from '@/app/providers/teacher'
import type { CampusEvent, EventOrg } from '@/data/community'

/**
 * The single read surface for student-facing Community data. It serves the
 * MERGE of the static seed and any organizer-portal content (approved orgs +
 * their events) — see `TeacherProvider`'s `communityOrgs`/`communityEvents`.
 *
 * Every Community screen reads through this hook (not `@/data/community`
 * directly) so a portal publish shows up in the feed/profiles/search/follow
 * with no extra wiring. The helpers mirror the pure ones in `data/community.ts`
 * but operate over the merged arrays.
 */
export function useCommunity() {
  const { communityOrgs, communityEvents } = useTeacher()

  return useMemo(() => {
    const orgs = communityOrgs
    const events = communityEvents

    const slug = (org: EventOrg) => org.handle.replace(/^@/, '')

    return {
      orgs,
      events,
      eventById: (id: string): CampusEvent | undefined => events.find((e) => e.id === id),
      orgBySlug: (s: string): EventOrg | undefined => orgs.find((o) => slug(o) === s),
      orgByHandle: (handle: string): EventOrg | undefined =>
        orgs.find((o) => o.handle === handle),
      searchOrgs: (query: string): EventOrg[] => {
        const q = query.trim().toLowerCase()
        if (!q) return []
        return orgs
          .filter((o) => o.name.toLowerCase().includes(q) || o.handle.toLowerCase().includes(q))
          .sort((a, b) => a.name.localeCompare(b.name))
      },
      eventsByOrg: (handle: string, now: Date) => {
        const mine = events.filter((e) => e.org.handle === handle)
        const t = now.getTime()
        return {
          upcoming: mine
            .filter((e) => new Date(e.start).getTime() >= t)
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
          past: mine
            .filter((e) => new Date(e.start).getTime() < t)
            .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()),
        }
      },
      moreFromHost: (event: CampusEvent, now: Date): CampusEvent[] =>
        events.filter(
          (e) => e.id !== event.id && e.org.handle === event.org.handle && new Date(e.start) >= now,
        ),
      recentEventsFromOrgs: (handles: string[], now: Date): CampusEvent[] => {
        const set = new Set(handles)
        const t = now.getTime()
        return events
          .filter((e) => set.has(e.org.handle) && new Date(e.start).getTime() >= t)
          .sort((a, b) => a.postedDaysAgo - b.postedDaysAgo)
      },
    }
  }, [communityOrgs, communityEvents])
}
