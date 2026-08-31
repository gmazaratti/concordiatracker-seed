import { NavLink } from 'react-router-dom'
import { STUDENT_NAV } from '@/app/navigation'
import { useNavBadges } from '@/app/useNavBadges'
import { useT } from '@/i18n/i18n'
import { NavBadge } from './NavBadge'
import { cn } from '@/lib/cn'

/**
 * Mobile bottom bar: the five DESTINATIONS, and nothing else.
 *
 * Search used to live here too, and six was over the line — at 375px that is
 * 62px a slot, which is under the 44pt minimum once padding comes off, and the
 * labels only fitted because they had been squeezed. It also did not belong:
 * search is an ACTION, not a place, and mixing the two is what made the bar
 * read as a toolbar rather than a set of tabs. It now lives in the top bar,
 * where the other actions are.
 *
 * Labels truncate rather than wrap, because a bar whose height changes with the
 * active language is worse than a clipped word.
 */
export function MobileNav() {
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
    </nav>
  )
}
