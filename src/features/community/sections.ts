import { CalendarDays, MessageSquare, Newspaper, UserRound, type LucideIcon } from 'lucide-react'

/**
 * Community's own destinations. Three.
 *
 * It was four, and one of them was a lie: "Home" and "Events" rendered the same
 * feed, differing only in that Home also carried a search box. Two tabs showing
 * the same list is the fastest way to teach somebody that tabs here mean
 * nothing. The search moved up into the header, where it serves every section,
 * and the duplicate went.
 *
 * What is left is what this tab actually is: what is happening around you, the
 * people you talk to, and you.
 *
 * Notifications is deliberately NOT one of them: it is a full-screen overlay
 * opened from the bell on Events, exactly where Instagram, X and TikTok put it.
 * A tab for something you open, clear and leave would spend a permanent slot on
 * a temporary job.
 */
/**
 * FOUR now, and the fourth is not a fifth copy of the feed.
 *
 * Feed and Events are the two halves of "what is happening", split by the
 * question each answers: Feed is ordered by when something was POSTED and led
 * by what you follow (what is new); Events is ordered by when something STARTS
 * and filtered by category (what is on). The rule that killed the old "Home"
 * tab still holds — two tabs may not render the same list in the same order —
 * and these do not.
 */
export type CommunitySection = 'feed' | 'events' | 'messages' | 'profile'

export const COMMUNITY_SECTIONS: {
  id: CommunitySection
  label: string
  icon: LucideIcon
}[] = [
  { id: 'feed', label: 'Feed', icon: Newspaper },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'profile', label: 'You', icon: UserRound },
]

const IDS = new Set<string>(COMMUNITY_SECTIONS.map((s) => s.id))

export function isCommunitySection(v: string | null): v is CommunitySection {
  return !!v && IDS.has(v)
}

/**
 * The landing section, which carries no param so it has ONE address.
 *
 * Feed, not Events: opening Community asks "what have I missed", and that is
 * the question the feed is ordered to answer. Events is one tap away and is
 * where you go when you already know you are looking for something.
 */
export const DEFAULT_SECTION: CommunitySection = 'feed'

export function communityHref(section: CommunitySection): string {
  return section === DEFAULT_SECTION ? '/app/community' : `/app/community?c=${section}`
}
