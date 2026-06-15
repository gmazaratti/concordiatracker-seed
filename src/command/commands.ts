import type { NavigateFunction } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Home,
  Palette,
  Settings,
  Sparkles,
  SquarePen,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Assessment, Course } from '@/data/types'

export type CommandGroup = 'Navigate' | 'Actions'

export interface CommandContext {
  navigate: NavigateFunction
  close: () => void
  toggleTheme: () => void
  /** Rewrite the palette query in place (the autofill — keeps the palette open). */
  setQuery: (text: string) => void
  /** Open a focused popup for a specific assessment / course. */
  openAssessment: (id: string) => void
  openCourse: (id: string) => void
}

export interface Command {
  id: string
  title: string
  hint?: string
  group: CommandGroup
  icon: LucideIcon
  keywords?: string[]
  /** Course code shown as a colored chip on the row (disambiguates targets). */
  badge?: string
  /** Course color id for the row chip / accent. */
  accentColor?: string
  /** Target commands generated from data — hidden until the user starts typing. */
  dynamic?: boolean
  perform: (ctx: CommandContext) => void
}

const go = (path: string) => (ctx: CommandContext) => {
  ctx.navigate(path)
  ctx.close()
}

/** A verb that autofills the query and keeps the palette open so the user can
 * narrow to a specific target (the "Change grade for…" → assignment flow). */
const fill = (text: string) => (ctx: CommandContext) => ctx.setQuery(text)

/**
 * The static spine: the four destinations + the rest of the app, plus generic
 * action VERBS. The verbs don't act on their own — they autofill the query so
 * the data-driven target commands (built in `dynamicCommands`) surface and
 * disambiguate as you type.
 */
export const STATIC_COMMANDS: Command[] = [
  // ---- Navigate ----
  { id: 'nav-today', title: 'Today', hint: 'Go to', group: 'Navigate', icon: Home, keywords: ['home', 'launch', 'due'], perform: go('/app') },
  { id: 'nav-courses', title: 'Courses', hint: 'Go to', group: 'Navigate', icon: BookOpen, keywords: ['grades', 'classes', 'gpa'], perform: go('/app/courses') },
  { id: 'nav-calendar', title: 'Calendar', hint: 'Go to', group: 'Navigate', icon: CalendarDays, keywords: ['month', 'week', 'schedule', 'dates'], perform: go('/app/calendar') },
  { id: 'nav-community', title: 'Community', hint: 'Go to', group: 'Navigate', icon: Users, keywords: ['events', 'orgs', 'clubs'], perform: go('/app/community') },
  { id: 'nav-settings', title: 'Settings', hint: 'Go to', group: 'Navigate', icon: Settings, keywords: ['profile', 'billing', 'theme', 'account'], perform: go('/app/settings') },
  { id: 'nav-teacher', title: 'Teacher portal', hint: 'Go to', group: 'Navigate', icon: GraduationCap, keywords: ['instructor', 'class', 'blueprint', 'announcement'], perform: go('/teacher') },
  { id: 'nav-landing', title: 'Marketing site', hint: 'Go to', group: 'Navigate', icon: Sparkles, keywords: ['landing', 'home', 'pricing', 'public'], perform: go('/') },

  // ---- Action verbs (autofill → narrow to a target) ----
  {
    id: 'verb-change-grade',
    title: 'Change grade for…',
    hint: 'Action',
    group: 'Actions',
    icon: SquarePen,
    keywords: ['edit', 'mark', 'score', 'assignment', 'quiz', 'exam'],
    perform: fill('Change grade for '),
  },
  {
    id: 'verb-open-class',
    title: 'Open a class…',
    hint: 'Action',
    group: 'Actions',
    icon: BookOpen,
    keywords: ['course', 'go to', 'class', 'grades'],
    perform: fill('Open '),
  },
  {
    id: 'action-import-blueprint',
    title: 'Import syllabus',
    hint: 'Action',
    group: 'Actions',
    icon: Upload,
    keywords: ['blueprint', 'outline', 'parse', 'contribute', 'hist 203'],
    perform: go('/app/courses/hist203'),
  },
  {
    id: 'action-switch-theme',
    title: 'Switch theme',
    hint: 'Action',
    group: 'Actions',
    icon: Palette,
    keywords: ['dark', 'maroon', 'concordia', 'skin', 'appearance'],
    perform: (ctx) => {
      ctx.toggleTheme()
      ctx.close()
    },
  },
]

/**
 * Data-driven target commands: one "Change grade for {title}" per assessment and
 * one "Open {code}" per course. They carry the course code/title as keywords so
 * "change grade for assignment 1" narrows to every matching assignment across
 * classes, and the course code disambiguates. Hidden until the query is non-empty.
 */
export function dynamicCommands(
  courses: Course[],
  assessments: Assessment[],
): Command[] {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const out: Command[] = []

  for (const c of courses) {
    out.push({
      id: `open-${c.id}`,
      title: `${c.code} — ${c.title}`,
      hint: 'Open class',
      group: 'Actions',
      icon: BookOpen,
      badge: c.code,
      accentColor: c.color,
      dynamic: true,
      keywords: ['open', 'class', 'course', 'go to', 'grades'],
      perform: (ctx) => {
        ctx.openCourse(c.id)
        ctx.close()
      },
    })
  }

  for (const a of assessments) {
    const c = byId.get(a.courseId)
    if (!c) continue
    out.push({
      id: `grade-${a.id}`,
      title: `Change grade for ${a.title}`,
      group: 'Actions',
      icon: SquarePen,
      badge: c.code,
      accentColor: c.color,
      dynamic: true,
      keywords: [c.code, c.title, a.kind, 'grade', 'score', 'mark', 'edit'],
      perform: (ctx) => {
        ctx.openAssessment(a.id)
        ctx.close()
      },
    })
  }

  return out
}

/** Lightweight ranked matcher: every query token must appear in the haystack.
 * Dynamic target commands stay hidden until the user starts typing. */
export function matchCommands(query: string, commands: Command[]): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands.filter((c) => !c.dynamic)

  const tokens = q.split(/\s+/)
  const scored: { cmd: Command; score: number }[] = []

  for (const cmd of commands) {
    const haystack = `${cmd.title} ${cmd.keywords?.join(' ') ?? ''}`.toLowerCase()
    if (!tokens.every((t) => haystack.includes(t))) continue

    const title = cmd.title.toLowerCase()
    let score = 0
    if (title.startsWith(q)) score += 100
    if (title.includes(q)) score += 40
    score -= title.indexOf(tokens[0]) // earlier match ranks higher
    scored.push({ cmd, score })
  }

  return scored.sort((a, b) => b.score - a.score).map((s) => s.cmd)
}
