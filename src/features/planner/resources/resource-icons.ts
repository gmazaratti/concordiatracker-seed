import {
  Accessibility,
  BookOpen,
  Briefcase,
  Bus,
  Compass,
  FileText,
  GraduationCap,
  HandCoins,
  HeartPulse,
  type LucideIcon,
  MessageCircleHeart,
  PenLine,
  Scale,
  Sigma,
  Wallet,
} from 'lucide-react'

/**
 * Each part of the directory has a fixed colour, the same in every theme, so
 * "health is rose, money is green" becomes something you recognise instead of
 * read. Same idea as course colours.
 */
export const GROUP_LOOK: Record<string, { icon: LucideIcon; hex: string; short: string }> = {
  advising: { icon: GraduationCap, hex: '#4f7df0', short: 'Advising' },
  records: { icon: FileText, hex: '#f0932b', short: 'Registration and fees' },
  learning: { icon: BookOpen, hex: '#12a594', short: 'Learning and careers' },
  health: { icon: HeartPulse, hex: '#e5487d', short: 'Health and access' },
  money: { icon: Wallet, hex: '#2fa35a', short: 'Money and international' },
  help: { icon: Scale, hex: '#8a5cd6', short: 'Problems and disputes' },
  new: { icon: Compass, hex: '#1c9cd8', short: 'New here' },
}

export const NEED_ICON: Record<string, LucideIcon> = {
  advisor: GraduationCap,
  fees: FileText,
  writing: PenLine,
  tutoring: Sigma,
  mind: MessageCircleHeart,
  access: Accessibility,
  money: HandCoins,
  dispute: Scale,
  shuttle: Bus,
  jobs: Briefcase,
}

/** A 12% wash of a hex, for icon tiles. */
export function wash(hex: string, alpha = 0.14): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export function groupOf(name: string, groups: { id: string; items: { name: string }[] }[]): string {
  return groups.find((g) => g.items.some((r) => r.name === name))?.id ?? 'advising'
}
