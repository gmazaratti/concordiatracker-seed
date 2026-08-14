import { BarChart3, Bus, CalendarClock, CloudSun, Flame, GraduationCap, Gauge, LayoutGrid, Target, Timer, type LucideIcon } from 'lucide-react'
import { NextClassWidget } from './NextClass'
import { ShuttleWidget } from './ShuttleWidget'
import { WeatherWidget } from './WeatherWidget'
import { CountdownWidget } from './CountdownWidget'
import { GradeGoalWidget } from './GradeGoalWidget'
import { CourseShortcutsWidget } from './CourseShortcutsWidget'
import { StreakWidget } from './StreakWidget'
import { StudyTimerWidget } from './StudyTimerWidget'
import { DebriefPanel } from '../DebriefPanel'

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

/**
 * Where a widget can live.
 *   rail — the 272px column beside the due list (all widgets fit here)
 *   wide — the full-width band above the due list, alone
 *   half — that same band, sharing a row with one other widget
 * A widget declares which of these it can render well in; the gallery only
 * offers it for zones it actually fits.
 */
export type WidgetZone = 'rail' | 'wide' | 'half'

export interface WidgetDef {
  id: string
  name: string
  /** One line in the gallery — what it does, not how. */
  description: string
  icon: LucideIcon
  /** Zones this widget has a layout for. Defaults to rail-only. */
  zones?: WidgetZone[]
  render: (zone: WidgetZone) => React.ReactNode
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
    zones: ['rail'],
    render: () => null, // supplied by TodayPage — see renderWidget there
  },
  {
    id: 'next-class',
    name: 'Next class',
    description: 'The next class you have, with its time and room.',
    icon: GraduationCap,
    zones: ['rail', 'half', 'wide'],
    render: (zone) => <NextClassWidget zone={zone} />,
    availableWhen: (ctx) => ctx.courseCount > 0,
  },
  {
    id: 'shuttle',
    name: 'Shuttle',
    description: 'Next SGW ↔ Loyola departures from the published timetable.',
    icon: Bus,
    zones: ['rail', 'half', 'wide'],
    render: () => <ShuttleWidget />,
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Montreal conditions — for the walk between buildings.',
    icon: CloudSun,
    zones: ['rail', 'half', 'wide'],
    render: () => <WeatherWidget />,
  },
  {
    id: 'countdown',
    name: 'Countdown',
    description: 'Days until your next exam, or any date you pick.',
    icon: CalendarClock,
    zones: ['rail', 'half', 'wide'],
    render: () => <CountdownWidget />,
  },
  {
    id: 'grade-goal',
    name: 'Grade goal',
    description: 'Pick a course and a target — see what you need on what is left.',
    icon: Target,
    zones: ['rail', 'half', 'wide'],
    render: () => <GradeGoalWidget />,
    availableWhen: (ctx) => ctx.courseCount > 0,
  },
  {
    id: 'shortcuts',
    name: 'Course shortcuts',
    description: 'Jump straight to any course.',
    icon: LayoutGrid,
    zones: ['rail', 'half', 'wide'],
    render: () => <CourseShortcutsWidget />,
    availableWhen: (ctx) => ctx.courseCount > 0,
  },
  {
    id: 'streak',
    name: 'Streak',
    description: 'Days in a row you have finished something.',
    icon: Flame,
    zones: ['rail', 'half'],
    render: () => <StreakWidget />,
  },
  {
    id: 'timer',
    name: 'Focus timer',
    description: '25 minutes on, 5 off. Nothing is logged or scored.',
    icon: Timer,
    zones: ['rail', 'half'],
    render: () => <StudyTimerWidget />,
  },
  {
    id: 'workload',
    name: 'Term workload',
    description: 'Your term week by week, by weight.',
    icon: BarChart3,
    zones: ['wide'],
    render: () => <DebriefPanel />,
  },
]

export const WIDGETS_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]))

/** What a new account sees. Deliberately short — an empty rail invites adding,
 * a full one invites nothing. */
export const DEFAULT_WIDGETS = [GLANCE_ID, 'next-class']

/** The band above the due list starts empty — the term-workload panel that used
 * to live there is now an opt-in widget rather than something everyone gets. */
export const DEFAULT_TOP: string[] = []

/** One wide card, or two halves. More than two and they stop being readable. */
export const MAX_TOP = 2

export function fitsZone(w: WidgetDef, zone: WidgetZone): boolean {
  return (w.zones ?? ['rail']).includes(zone)
}

/** More than this and the rail stops being glanceable. A stated cap reads as
 * considered design; an unbounded list reads as a settings screen. */
export const MAX_WIDGETS = 5

/** Drop unknown ids (a widget removed in a later build) and de-duplicate, so a
 * stale saved layout can never crash Today or render something twice. */
export function sanitizeLayout(ids: string[] | undefined, fallback = DEFAULT_WIDGETS): string[] {
  if (!ids) return fallback
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
