import { NavLink } from 'react-router-dom'
import { Search } from 'lucide-react'
import { STUDENT_NAV } from '@/app/navigation'
import { useNavBadges } from '@/app/useNavBadges'
import { useT } from '@/i18n/i18n'
import { useCommandPalette } from '@/app/providers/command-palette'
import { NavBadge } from './NavBadge'
import { cn } from '@/lib/cn'

/**
 * Mobile bottom bar: every destination plus the palette trigger (the "bottom
 * search bar on mobile"). The palette itself opens as a bottom sheet.
 *
 * Six slots is the ceiling. Labels truncate rather than wrap, because a bar
 * whose height changes with the active language is worse than a clipped word,
 * and the icon carries the meaning at this size anyway.
 */
export function MobileNav() {
  const { openPalette } = useCommandPalette()
  const badges = useNavBadges()
  const t = useT()
  return (
    <nav className="flex shrink-0 items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {STUDENT_NAV.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors duration-150',
              isActive ? 'text-accent' : 'text-subtle',
            )
          }
        >
          {/* Badge floats over the icon so a count never shifts the bar. */}
          <span className="relative">
            <Icon size={20} aria-hidden />
            {badges[to] && (
              <NavBadge badge={badges[to]!} className="absolute -top-1.5 -right-2.5 ring-2 ring-surface" />
            )}
          </span>
          <span className="w-full truncate text-center tracking-tight">{t(labelKey)}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={openPalette}
        aria-label={t('nav.search')}
        className="flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] text-muted"
      >
        <Search size={20} aria-hidden />
        <span className="w-full truncate text-center tracking-tight">{t('nav.search')}</span>
      </button>
    </nav>
  )
}
