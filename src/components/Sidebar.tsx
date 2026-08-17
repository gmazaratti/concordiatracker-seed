import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Inbox, PanelLeftClose, Settings } from 'lucide-react'
import { STUDENT_NAV } from '@/app/navigation'
import { useNavBadges } from '@/app/useNavBadges'
import { useT } from '@/i18n/i18n'
import { useSettings } from '@/app/providers/settings'
import { useUiState } from '@/app/providers/ui-state'
import { NavBadge } from './NavBadge'
import { Logo } from './Logo'
import { SearchTrigger } from './SearchTrigger'
import { AvatarMenu } from './AvatarMenu'
import { cn } from '@/lib/cn'

const COLLAPSE_KEY = 'ct_sidebar_collapsed'

/** Desktop left rail: wordmark, palette trigger, the destinations (+ the opt-in
 *  pinned Feedback board), and the avatar menu at the bottom.
 *
 *  Collapsible to icons. The planner and the schedule builder want horizontal
 *  room that a 256px rail is spending on words you already know, and on a small
 *  laptop that is the difference between reading a week and scrolling one. The
 *  choice is per-device (localStorage), because it is about the screen in front
 *  of you, not about you. */
export function Sidebar() {
  const { uiState } = useUiState()
  const badges = useNavBadges()
  const t = useT()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  function toggle() {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* private mode - it just will not persist */
      }
      return next
    })
  }

  return (
    <aside
      className={cn(
        'relative hidden shrink-0 flex-col gap-1 border-r border-border bg-surface/40 p-3 md:flex',
        // Width is the only thing that transitions. Fading the labels in and out
        // as well made a 200ms toggle feel like a page load.
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* The wordmark keeps its place; the toggle sits beside it. A control
          that lives at the bottom of a rail is a control nobody finds. */}
      <div
        className={cn(
          'flex items-center py-3',
          collapsed ? 'justify-center' : 'gap-2 px-2',
        )}
      >
        <Logo showText={!collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
            collapsed ? 'absolute top-3 right-2' : 'ml-auto',
          )}
        >
          <PanelLeftClose
            size={16}
            className={cn('transition-transform duration-200', collapsed && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>

      {!collapsed && <SearchTrigger className="mb-2" />}

      <nav className="flex flex-col gap-1">
        {STUDENT_NAV.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? t(labelKey) : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg py-2 text-sm transition-colors duration-150',
                collapsed ? 'justify-center px-0' : 'px-3',
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
                    'shrink-0 transition-colors duration-150',
                    isActive
                      ? 'text-accent'
                      : 'text-subtle group-hover:text-muted',
                  )}
                  aria-hidden
                />
                {collapsed ? (
                  <>
                    <span className="sr-only">{t(labelKey)}</span>
                    {/* A badge still has to be visible when the label is not -
                        it is the whole reason you would glance at the rail. */}
                    {badges[to] && (
                      <span
                        className="absolute top-1 right-1 size-2 rounded-full bg-accent"
                        aria-hidden
                      />
                    )}
                  </>
                ) : (
                  <>
                    <span className="flex-1">{t(labelKey)}</span>
                    {badges[to] && <NavBadge badge={badges[to]!} />}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Opt-in pin (from the Feedback board's floating toast). Opens the
            in-app feedback page so the sidebar stays; unpin from the toast. */}
        {uiState.feedbackPinned && (
          <NavLink
            to="/app/requests"
            title={collapsed ? t('nav.feedback') : undefined}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg py-2 text-sm transition-colors duration-150',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <Inbox size={18} className="shrink-0 text-subtle transition-colors duration-150 group-hover:text-muted" aria-hidden />
            {collapsed ? <span className="sr-only">{t('nav.feedback')}</span> : t('nav.feedback')}
          </NavLink>
        )}
      </nav>

      <div className="flex-1" />

      <div className={cn('flex items-center gap-1.5', collapsed && 'flex-col')}>
        <div className={cn('min-w-0', !collapsed && 'flex-1')}>
          <AvatarMenu align="bottom" compact={collapsed} />
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
      className="group grid size-9 shrink-0 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      <Settings
        size={18}
        className="transition-transform duration-500 ease-out group-hover:rotate-[90deg]"
        aria-hidden
      />
    </button>
  )
}
