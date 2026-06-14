import type { NavigateFunction } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Home,
  Palette,
  Plus,
  Settings,
  Sparkles,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type CommandGroup = 'Navigate' | 'Actions'

export interface CommandContext {
  navigate: NavigateFunction
  close: () => void
  toggleTheme: () => void
}

export interface Command {
  id: string
  title: string
  hint?: string
  group: CommandGroup
  icon: LucideIcon
  keywords?: string[]
  perform: (ctx: CommandContext) => void
}

const go = (path: string) => (ctx: CommandContext) => {
  ctx.navigate(path)
  ctx.close()
}

/**
 * The command registry — the app's real navigation spine.
 * Navigation commands are fully wired. The example "Actions" are typeahead
 * stubs for step 1 (they route to the relevant screen); their real behavior
 * is wired when Courses ships.
 */
export const COMMANDS: Command[] = [
  // ---- Navigate ----
  {
    id: 'nav-today',
    title: 'Today',
    hint: 'Go to',
    group: 'Navigate',
    icon: Home,
    keywords: ['home', 'launch', 'due'],
    perform: go('/app'),
  },
  {
    id: 'nav-courses',
    title: 'Courses',
    hint: 'Go to',
    group: 'Navigate',
    icon: BookOpen,
    keywords: ['grades', 'classes', 'gpa'],
    perform: go('/app/courses'),
  },
  {
    id: 'nav-calendar',
    title: 'Calendar',
    hint: 'Go to',
    group: 'Navigate',
    icon: CalendarDays,
    keywords: ['month', 'week', 'schedule', 'dates'],
    perform: go('/app/calendar'),
  },
  {
    id: 'nav-community',
    title: 'Community',
    hint: 'Go to',
    group: 'Navigate',
    icon: Users,
    keywords: ['events', 'orgs', 'clubs'],
    perform: go('/app/community'),
  },
  {
    id: 'nav-settings',
    title: 'Settings',
    hint: 'Go to',
    group: 'Navigate',
    icon: Settings,
    keywords: ['profile', 'billing', 'theme', 'account'],
    perform: go('/app/settings'),
  },
  {
    id: 'nav-teacher',
    title: 'Teacher portal',
    hint: 'Go to',
    group: 'Navigate',
    icon: GraduationCap,
    keywords: ['instructor', 'class', 'blueprint', 'announcement'],
    perform: go('/teacher'),
  },
  {
    id: 'nav-landing',
    title: 'Marketing site',
    hint: 'Go to',
    group: 'Navigate',
    icon: Sparkles,
    keywords: ['landing', 'home', 'pricing', 'public'],
    perform: go('/'),
  },

  // ---- Actions (step-1 typeahead stubs; real wiring in Courses) ----
  {
    id: 'action-add-course',
    title: 'Add course COMM 217',
    hint: 'Action',
    group: 'Actions',
    icon: Plus,
    keywords: ['new', 'enroll', 'create'],
    perform: go('/app/courses'),
  },
  {
    id: 'action-change-grade',
    title: 'Change grade for Assignment 2',
    hint: 'Action',
    group: 'Actions',
    icon: BookOpen,
    keywords: ['edit', 'mark', 'score'],
    perform: go('/app/courses'),
  },
  {
    id: 'action-import-blueprint',
    title: 'Import blueprint',
    hint: 'Action',
    group: 'Actions',
    icon: Upload,
    keywords: ['syllabus', 'outline', 'parse', 'contribute'],
    perform: go('/app/courses'),
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

/** Lightweight ranked matcher: every query token must appear in the haystack. */
export function matchCommands(query: string): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return COMMANDS

  const tokens = q.split(/\s+/)
  const scored: { cmd: Command; score: number }[] = []

  for (const cmd of COMMANDS) {
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
