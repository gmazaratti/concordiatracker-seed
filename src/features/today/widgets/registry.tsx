import { Bus, CloudSun, GraduationCap, Gauge, type LucideIcon } from 'lucide-react'
import { NextClassWidget } from './NextClass'
import { ShuttleWidget } from './ShuttleWidget'
import { WeatherWidget } from './WeatherWidget'

/**
 * Every widget Today can show.
 *
 * THE RULE: the due list is not in here, and never will be. Widgets decorate the
 * screen around the spine; they can't replace it, sit above it, or push it below
 * the fold. iPhone widgets work because the home screen has no other job — Today
 * has exactly one, and this registry exists to keep that true while still
 * letting the screen feel like yours.
 *
 * Adding a feature: add an entry here. It shows up in the gallery, becomes
 * addable, and needs no route, no tab, and no nav change.
 */

export interface WidgetDef {
  id: string
  name: string
  /** One line in the gallery — what it does, not how. */
  description: string
  icon: LucideIcon
  render: () => React.ReactNode
  /**
   * Hide from the gallery when it can't be useful yet, so nobody adds a widget
   * that renders an empty box. `glance` has no gate — it always has something.
   */
  availableWhen?: (ctx: WidgetContext) => boolean
}

export interface WidgetContext {
  courseCount: number
}

/** The glance panel is a widget like any other — it just happens to be the one
 * most people keep. Rendering is injected by TodayPage since it needs the term
 * totals already computed there. */
export const GLANCE_ID = 'glance'

export const WIDGETS: WidgetDef[] = [
  {
    id: GLANCE_ID,
    name: 'At a glance',
    description: 'GPA, overdue count, what is due this week, and term progress.',
    icon: Gauge,
    render: () => null, // supplied by TodayPage — see renderWidget there
  },
  {
    id: 'next-class',
    name: 'Next class',
    description: 'The next class you have, with its time and room.',
    icon: GraduationCap,
    render: () => <NextClassWidget />,
    availableWhen: (ctx) => ctx.courseCount > 0,
  },
  {
    id: 'shuttle',
    name: 'Shuttle',
    description: 'Next SGW ↔ Loyola departures from the published timetable.',
    icon: Bus,
    render: () => <ShuttleWidget />,
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Montreal conditions — for the walk between buildings.',
    icon: CloudSun,
    render: () => <WeatherWidget />,
  },
]

export const WIDGETS_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]))

/** What a new account sees. Deliberately short — an empty rail invites adding,
 * a full one invites nothing. */
export const DEFAULT_WIDGETS = [GLANCE_ID, 'next-class']

/** More than this and the rail stops being glanceable. A stated cap reads as
 * considered design; an unbounded list reads as a settings screen. */
export const MAX_WIDGETS = 5

/** Drop unknown ids (a widget removed in a later build) and de-duplicate, so a
 * stale saved layout can never crash Today or render something twice. */
export function sanitizeLayout(ids: string[] | undefined): string[] {
  if (!ids) return DEFAULT_WIDGETS
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (WIDGETS_BY_ID.has(id) && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}
