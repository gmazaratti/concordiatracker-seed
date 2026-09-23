import {
  BookOpen,
  CalendarDays,
  Camera,
  ClipboardList,
  Code,
  Crown,
  Flag,
  GraduationCap,
  Handshake,
  Heart,
  Megaphone,
  Mic,
  Music,
  Palette,
  Pencil,
  Rocket,
  Shield,
  Star,
  Trophy,
  User,
  Users,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * A role, wherever one is shown.
 *
 * THE ICON MAP IS EXPLICIT rather than a dynamic lookup into all of lucide.
 * That library is a thousand components; pulling it in by name to render a
 * badge would put the whole thing in the bundle for two dozen glyphs. It also
 * means a stored name nobody recognises falls back to a shield instead of
 * throwing — a role with a renamed icon should still be a role.
 */
export const ROLE_ICONS: Record<string, LucideIcon> = {
  Crown,
  Star,
  Shield,
  User,
  Users,
  Megaphone,
  Camera,
  CalendarDays,
  ClipboardList,
  Wallet,
  GraduationCap,
  Pencil,
  Wrench,
  Code,
  Palette,
  Mic,
  Music,
  BookOpen,
  Trophy,
  Handshake,
  Heart,
  Rocket,
  Flag,
  Zap,
}
