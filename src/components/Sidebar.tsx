import { NavLink } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { STUDENT_NAV } from '@/app/navigation'
import { useSettings } from '@/app/providers/settings'
import { Logo } from './Logo'
import { SearchTrigger } from './SearchTrigger'
import { AvatarMenu } from './AvatarMenu'
import { cn } from '@/lib/cn'

/** Desktop left rail: wordmark, palette trigger, the four destinations,
 *  and the avatar menu pinned to the bottom. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-border bg-surface/40 p-3 md:flex">
      <div className="px-2 py-3">
        <Logo />
      </div>

      <SearchTrigger className="mb-2" />

      <nav className="flex flex-col gap-1">
        {STUDENT_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                isActive
                  ? 'bg-accent-soft font-medium text-fg'
                  : 'text-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={cn(
                    'transition-colors duration-150',
                    isActive
                      ? 'text-accent'
                      : 'text-subtle group-hover:text-muted',
                  )}
                  aria-hidden
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <AvatarMenu align="bottom" />
        </div>
        <SettingsGearButton />
      </div>
    </aside>
  )
}

/** The settings affordance beside the profile block — opens the floating panel. */
function SettingsGearButton() {
  const { openSettings } = useSettings()
  return (
    <button
      type="button"
      onClick={() => openSettings()}
      aria-label="Open settings"
      title="Settings"
      className="grid size-9 shrink-0 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      <Settings size={18} aria-hidden />
    </button>
  )
}
