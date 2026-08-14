import type { Key } from '@/i18n/en'
import {
  BookOpen,
  CalendarDays,
  Home,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  /** Fallback label; UI should prefer `labelKey` through the translator. */
  label: string
  /** Translation key for the label. */
  labelKey: Key
  icon: LucideIcon
  /** exact match (so /app doesn't stay active on /app/courses) */
  end?: boolean
}

/**
 * The student app's EXACTLY FOUR top-level destinations. Defined once and
 * rendered by both the desktop sidebar and the mobile bottom bar so there is
 * a single source of truth for the rule. Nothing else gets a tab — Settings
 * and the Teacher portal are reached via the avatar menu + command palette.
 */
export const STUDENT_NAV: NavItem[] = [
  { to: '/app', label: 'Today', labelKey: 'nav.today', icon: Home, end: true },
  { to: '/app/courses', label: 'Courses', labelKey: 'nav.courses', icon: BookOpen },
  { to: '/app/calendar', label: 'Calendar', labelKey: 'nav.calendar', icon: CalendarDays },
  { to: '/app/community', label: 'Community', labelKey: 'nav.community', icon: Users },
]
