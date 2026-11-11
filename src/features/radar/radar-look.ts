import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  GraduationCap,
  type LucideIcon,
  ScanSearch,
  Weight,
} from 'lucide-react'
import type { Severity, Signal } from './rules'

/**
 * How Radar looks, in one place. Severity uses the theme's status tokens (red
 * means the same thing everywhere in the app); a topic has a fixed colour of
 * its own, the same idea as course colours and the Resources categories.
 */
export const SEVERITY: Record<Severity, { label: string; text: string; bg: string; ring: string; icon: LucideIcon }> = {
  critical: { label: 'Decide now', text: 'text-danger', bg: 'bg-danger', ring: 'border-danger/45', icon: AlertTriangle },
  warning: { label: 'This week', text: 'text-warning', bg: 'bg-warning', ring: 'border-warning/45', icon: AlertTriangle },
  watch: { label: 'Keep an eye', text: 'text-info', bg: 'bg-info', ring: 'border-border', icon: Eye },
  clear: { label: 'Clear', text: 'text-success', bg: 'bg-success', ring: 'border-border', icon: CheckCircle2 },
}

export const TOPIC: Record<Signal['topic'], { label: string; hex: string; icon: LucideIcon; blurb: string }> = {
  load: { label: 'Workload', hex: '#f0932b', icon: Weight, blurb: 'How much of your grade lands at once.' },
  deadlines: { label: 'Deadlines', hex: '#e5487d', icon: CalendarClock, blurb: 'Registrar dates that close for good.' },
  grades: { label: 'Grades', hex: '#4f7df0', icon: GraduationCap, blurb: 'Courses the marks can still save, or not.' },
  coverage: { label: 'What we can see', hex: '#12a594', icon: ScanSearch, blurb: 'Gaps that would hide a problem.' },
}

/** A translucent wash of a hex, for tinted surfaces. */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
