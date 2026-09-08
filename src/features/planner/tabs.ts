import {
  Bell,
  BookOpen,
  Bookmark,
  CalendarRange,
  GitBranch,
  GraduationCap,
  Radar as RadarIcon,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Key } from '@/i18n/en'

/**
 * The planner's sections, as data.
 *
 * Its own module because the app sidebar renders them now — the planner used to
 * carry a second vertical rail of its own, so the screen had two navigation
 * columns side by side and the builder's three panes were squeezed into what
 * was left. Sub-items under Planner in the one sidebar say the same thing and
 * give the page back two hundred pixels.
 *
 * A plain data module, so `components/Sidebar` can read it without pulling in
 * the planner's components.
 */
export type Phase = 'know' | 'explore' | 'commit'

/** One section, as the drawer wants it: labels already translated. */
export interface NavItem<T extends string> {
  id: T
  label: string
  icon: LucideIcon
  phase: Phase
}

export type PlannerTab =
  | 'record'
  | 'program'
  | 'radar'
  | 'seats'
  | 'directory'
  | 'saved'
  | 'tree'
  | 'schedule'
  | 'money'

/** Phase headings. Naming the phases is what turns nine sections into one
 *  sequence you move through rather than nine unrelated tabs. */
export const PHASE_LABEL: Record<Phase, string> = {
  know: 'What you have done',
  explore: 'What you could take',
  commit: 'What you are taking',
}

/**
 * Ordered by the sequence someone actually does this in, and grouped into the
 * three phases of it, rather than by the order the sections were built.
 *
 * You start from what you have done, go looking at what exists, then commit to
 * a week and chase the seats.
 */
export const PLANNER_TABS: {
  id: PlannerTab
  labelKey: Key
  icon: LucideIcon
  phase: Phase
}[] = [
  { id: 'record', labelKey: 'planner.tab.record', icon: GraduationCap, phase: 'know' },
  { id: 'program', labelKey: 'planner.tab.program', icon: Target, phase: 'know' },
  // Radar is about the term you are RUNNING, not the one you are choosing,
  // which argued for a tab of its own. But it is a sit-down-and-review surface
  // used occasionally and deliberately, and that is Planner's mode rather than
  // Today's. Folding it in also settles the mobile bar, full at six slots.
  { id: 'radar', labelKey: 'planner.tab.radar', icon: RadarIcon, phase: 'know' },

  { id: 'directory', labelKey: 'planner.tab.directory', icon: BookOpen, phase: 'explore' },
  { id: 'tree', labelKey: 'planner.tab.tree', icon: GitBranch, phase: 'explore' },
  { id: 'saved', labelKey: 'planner.tab.saved', icon: Bookmark, phase: 'explore' },

  { id: 'schedule', labelKey: 'planner.tab.schedule', icon: CalendarRange, phase: 'commit' },
  { id: 'seats', labelKey: 'planner.tab.seats', icon: Bell, phase: 'commit' },
  { id: 'money', labelKey: 'planner.tab.money', icon: Wallet, phase: 'commit' },
]

export const PLANNER_TAB_IDS = new Set<string>(PLANNER_TABS.map((x) => x.id))

/** The URL for a section. `record` is the default, so it carries no query —
 *  one canonical address for the landing state rather than two. */
export function plannerHref(tab: PlannerTab): string {
  return tab === 'record' ? '/app/planner' : `/app/planner?tab=${tab}`
}
