import type { Key } from '@/i18n/en'
import {
  BookOpen,
  CalendarDays,
  Compass,
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
 * The student app's top-level destinations. Defined once and rendered by both
 * the desktop sidebar and the mobile bottom bar so there is a single source of
 * truth. Nothing gets added here casually: Settings, the portals, and every
 * tool live behind the avatar menu, the command palette, or a Today widget.
 *
 * Planner is the one deliberate addition to the original four. The test a tab
 * has to pass is "is this a PLACE you go and stay", not "is this important",
 * and Planner passes it: Today, Courses and Calendar are all about the term you
 * are running, while choosing next term's classes is a different activity done
 * at a different time of year. Its four sections (seat watch, course directory,
 * prerequisite tree, schedule builder) are one job, not four, which is exactly
 * why they sit behind one tab instead of four.
 */
export const STUDENT_NAV: NavItem[] = [
  { to: '/app', label: 'Today', labelKey: 'nav.today', icon: Home, end: true },
  { to: '/app/courses', label: 'Courses', labelKey: 'nav.courses', icon: BookOpen },
  { to: '/app/calendar', label: 'Calendar', labelKey: 'nav.calendar', icon: CalendarDays },
  { to: '/app/planner', label: 'Planner', labelKey: 'nav.planner', icon: Compass },
  { to: '/app/community', label: 'Community', labelKey: 'nav.community', icon: Users },
]
