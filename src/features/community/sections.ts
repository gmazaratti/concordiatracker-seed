import {
  CalendarDays,
  Compass,
  MessageSquare,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

/**
 * Community's own destinations.
 *
 * Four, matching the shape every social app has settled on — a mixed home, a
 * place to find things, messages, and you — because familiarity is the whole
 * point here. A student arriving at this tab has used Instagram for a decade
 * and should not have to learn anything.
 *
 * Notifications is deliberately NOT one of them: it is a full-screen overlay
 * opened from the top right, exactly where Instagram, X and TikTok put it. A
 * fifth tab for something you visit, clear, and leave would spend a permanent
 * slot on a temporary job.
 */
export type CommunitySection = 'home' | 'events' | 'messages' | 'profile'

export const COMMUNITY_SECTIONS: {
  id: CommunitySection
  label: string
  icon: LucideIcon
}[] = [
  { id: 'home', label: 'Home', icon: Compass },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'profile', label: 'You', icon: UserRound },
]

const IDS = new Set<string>(COMMUNITY_SECTIONS.map((s) => s.id))

export function isCommunitySection(v: string | null): v is CommunitySection {
  return !!v && IDS.has(v)
}

/** The URL for a section. `home` carries no param, so the landing state has one
 *  address rather than two. */
export function communityHref(section: CommunitySection): string {
  return section === 'home' ? '/app/community' : `/app/community?c=${section}`
}
