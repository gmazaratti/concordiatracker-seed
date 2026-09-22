import { Fragment, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Inbox, PanelLeftClose, Settings } from 'lucide-react'
import { STUDENT_NAV } from '@/app/navigation'
import { useNavBadges } from '@/app/useNavBadges'
import { useT } from '@/i18n/i18n'
import { NotificationsBell } from './NotificationsBell'
import { useSettings } from '@/app/providers/settings'
import { useUiState } from '@/app/providers/ui-state'
import { NavBadge } from './NavBadge'
import { Logo } from './Logo'
import { SearchTrigger } from './SearchTrigger'
import { PlannerSubNav } from './PlannerSubNav'
import { SocialSubNav } from './SocialSubNav'
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
  // The planner's sections nest under it while you are in there, so the page
  // does not need a second rail of its own.
  const path = useLocation().pathname
  const onPlanner = path.startsWith('/app/planner')
  const onSocial = path.startsWith('/app/community')
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
          <Fragment key={to}>
          <NavLink
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
          {/* Only while you are in the planner, and only when there is room for
              words: a nine-item subtree pinned open would make Planner read as
              the centre of the app, and it is not — Today is.

              It stays MOUNTED and animates its height, so it slides out from
              under Planner and folds back when you leave, instead of nine rows
              appearing and vanishing between one frame and the next. */}
          {to === '/app/planner' && !collapsed && <PlannerSubNav open={onPlanner} />}
          {to === '/app/community' && !collapsed && <SocialSubNav open={onSocial} />}
          </Fragment>
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

      {/*
        THE TWO ICONS ARE ONE CLUSTER. Adding the bell beside the gear at
        36px each with a gap between them took ~80px out of a 232px rail and
        truncated the name to "Alex Degr…". They are 32px now and sit flush
        against each other — they belong together, they are both "about you
        rather than about the page", and reading them as one control is
        honest as well as narrower.
      */}
      <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
        <div className={cn('min-w-0', !collapsed && 'flex-1')}>
          {/* Collapsed, the face sits in a 68px rail at the left edge, so the
              menu has to open into the page. Right-anchored it went off the
              side of the screen. */}
          <AvatarMenu align="bottom" compact={collapsed} side={collapsed ? 'left' : 'right'} />
        </div>
        <div className={cn('flex shrink-0 items-center', collapsed && 'flex-col')}>
          <NotificationsBell />
          <SettingsGearButton />
        </div>
      </div>
    </aside>
  )
}

/**
 * Notifications, in the footer beside settings.
 *
 * It lived alone in Community's page header, which cost that tab a strip of
 * empty space across the top to hold one control — and it meant the only way
 * to see a notification was to already be in Community. Down here it sits
 * with the two other things that are about YOU rather than about the page,
 * and it is on screen from every destination.
 *
 * A LINK, not a button. `?activity=1` is the panel's address, so this, the
 * toast and the avatar menu all point at the same thing without anyone
 * hoisting state out of Community.
 */
/** The settings affordance beside the profile block — opens the floating panel. */
function SettingsGearButton() {
  const { openSettings } = useSettings()
  return (
    <button
      type="button"
      onClick={() => openSettings()}
      aria-label="Open settings"
      title="Settings"
      className="group grid size-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      <Settings
        size={18}
        className="transition-transform duration-500 ease-out group-hover:rotate-[90deg]"
        aria-hidden
      />
    </button>
  )
}
