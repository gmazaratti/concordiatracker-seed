import {
  Bell,
  BookOpenCheck,
  CalendarPlus,
  CalendarRange,
  Calculator,
  GraduationCap,
  History,
  ListChecks,
  NotebookPen,
  PartyPopper,
  RefreshCw,
  ScanLine,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { DiscoveryIcon } from '@/lib/discovery'

const ICONS: Record<DiscoveryIcon, LucideIcon> = {
  scan: ScanLine,
  grade: Calculator,
  history: History,
  target: Target,
  trend: TrendingUp,
  moodle: RefreshCw,
  degree: GraduationCap,
  schedule: CalendarRange,
  seat: BookOpenCheck,
  bell: Bell,
  calendar: CalendarPlus,
  clubs: PartyPopper,
  notes: NotebookPen,
  family: Users,
  tasks: ListChecks,
}

export function NudgeIcon({ icon, size = 16 }: { icon: DiscoveryIcon; size?: number }) {
  const Icon = ICONS[icon]
  return <Icon size={size} aria-hidden />
}
