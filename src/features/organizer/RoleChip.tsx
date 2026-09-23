import {
  CalendarDays,
  Crown,
  Megaphone,
  Pencil,
  Shield,
  Star,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A role, wherever one is shown.
 *
 * THE ICON MAP IS EXPLICIT rather than a dynamic lookup into all of lucide.
 * That library is a thousand components; pulling it in by name to render a
 * badge would put the whole thing in the bundle for eight glyphs. It also
 * means a stored name nobody recognises falls back to a shield instead of
 * throwing — a role with a renamed icon should still be a role.
 */
const ICONS: Record<string, LucideIcon> = {
  Shield,
  Crown,
  User,
  Megaphone,
  CalendarDays,
  Pencil,
  Star,
  Wrench,
}

interface RoleLike {
  name?: string
  color: string
  icon?: string | null
}

export function RoleGlyph({
  role,
  bare,
  className,
}: {
  role: RoleLike
  /** Inside a button that already carries the colour. */
  bare?: boolean
  className?: string
}) {
  const Icon = ICONS[role.icon ?? ''] ?? Shield
  if (bare) return <Icon size={16} aria-hidden />
  return (
    <span
      className={cn('grid size-9 shrink-0 place-items-center rounded-lg', className)}
      style={{ backgroundColor: `${role.color}22`, color: role.color }}
      aria-hidden
    >
      <Icon size={17} />
    </span>
  )
}

/** The name in the role's own colour — a fixed hex, like a course chip, so a
 *  role reads the same to everyone whatever theme they are on. */
export function RoleChip({ role, className }: { role: RoleLike; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium',
        className,
      )}
      style={{ backgroundColor: `${role.color}1f`, color: role.color }}
    >
      <RoleGlyph role={role} bare />
      {role.name}
    </span>
  )
}
