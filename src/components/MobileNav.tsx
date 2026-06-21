import { NavLink } from 'react-router-dom'
import { Search } from 'lucide-react'
import { STUDENT_NAV } from '@/app/navigation'
import { useCommandPalette } from '@/app/providers/command-palette'
import { cn } from '@/lib/cn'

/**
 * Mobile bottom bar: the four destinations plus the palette trigger (the
 * "bottom search bar on mobile"). The palette itself opens as a bottom sheet.
 */
export function MobileNav() {
  const { openPalette } = useCommandPalette()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {STUDENT_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors duration-150',
              isActive ? 'text-accent' : 'text-subtle',
            )
          }
        >
          <Icon size={20} aria-hidden />
          {label}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search or jump to"
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] text-muted"
      >
        <Search size={20} aria-hidden />
        Search
      </button>
    </nav>
  )
}
