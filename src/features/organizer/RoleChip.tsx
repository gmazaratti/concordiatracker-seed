import { Shield } from 'lucide-react'
import { ROLE_ICONS } from './role-icons'
import { cn } from '@/lib/cn'

/** A role, wherever one is shown. The icon map lives in role-icons.ts. */
const ICONS = ROLE_ICONS

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
