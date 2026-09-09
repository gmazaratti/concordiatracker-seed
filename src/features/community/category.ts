import { Briefcase, GraduationCap, Landmark, Users, type LucideIcon, PartyPopper } from 'lucide-react'
import type { EventCategory } from '@/data/community'

/** Category identity — fixed hexes (like course colors) so a category reads the
 * same across both themes; a label + icon for the tag. */
export const CATEGORY_META: Record<EventCategory, { label: string; hex: string; icon: LucideIcon }> = {
  clubs: { label: 'Clubs', hex: '#a78bfa', icon: Users },
  career: { label: 'Career', hex: '#5b9cf6', icon: Briefcase },
  academic: { label: 'Academic', hex: '#e0a13c', icon: GraduationCap },
  official: { label: 'Official', hex: '#4fb89a', icon: Landmark },
  nightlife: { label: 'Nightlife', hex: '#e0619a', icon: PartyPopper },
}

/** Ordered by how often a student reaches for them, not alphabetically. */
export const CATEGORY_ORDER: EventCategory[] = [
  'nightlife',
  'clubs',
  'career',
  'academic',
  'official',
]
