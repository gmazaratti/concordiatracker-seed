import {
  Accessibility,
  BookOpen,
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
  advising: { icon: GraduationCap, hex: '#7c9cf5', short: 'Advising' },
  records: { icon: FileText, hex: '#e0a458', short: 'Registration and fees' },
  learning: { icon: BookOpen, hex: '#5fb6a8', short: 'Learning and careers' },
  health: { icon: HeartPulse, hex: '#e58aa0', short: 'Health and access' },
  money: { icon: Wallet, hex: '#8fb39a', short: 'Money and international' },
  help: { icon: Scale, hex: '#b59be6', short: 'Problems and disputes' },
  new: { icon: Compass, hex: '#6fb4dd', short: 'New here' },
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
}

/** A 12% wash of a hex, for icon tiles. */
export function wash(hex: string, alpha = 0.14): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export function groupOf(name: string, groups: { id: string; items: { name: string }[] }[]): string {
  return groups.find((g) => g.items.some((r) => r.name === name))?.id ?? 'advising'
}
