import {
  BookOpen,
  CalendarDays,
  Home,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
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
  { to: '/app', label: 'Today', icon: Home, end: true },
  { to: '/app/courses', label: 'Courses', icon: BookOpen },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/community', label: 'Community', icon: Users },
]
