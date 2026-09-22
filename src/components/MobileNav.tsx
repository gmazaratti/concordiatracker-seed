import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { STUDENT_NAV } from '@/app/navigation'
import { useNavBadges } from '@/app/useNavBadges'
import { useUnreadMessages } from '@/app/usePeopleBadge'
import { useAppData } from '@/app/providers/app-data'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { useT } from '@/i18n/i18n'
import {
  COMMUNITY_SECTIONS,
  communityHref,
  DEFAULT_SECTION,
  isCommunitySection,
  type CommunitySection,
} from '@/features/community/sections'
import { NavBadge } from './NavBadge'
import { cn } from '@/lib/cn'

/**
 * The bottom bar, which has two states.
 *
 * NORMALLY it is the five destinations and nothing else. Inside COMMUNITY it
 * becomes Community's own bar: a back arrow where the platform back button
 * lives, then Events, Messages and You.
 *
 * WHY A SECOND STATE AT ALL. Community is three places, not one, and there is
 * no room for them: the bar is full at five, a rail costs the width a phone
 * does not have, and two bars stacked is the thing every guideline warns
 * about. The only other option is burying two of the three behind a menu,
 * which is how you build a section nobody uses.
 *
 * WHY IT IS SAFE. Nested navigation's real failure is not knowing which layer
 * you are in or how to leave — so the back arrow sits in the leftmost slot
 * (where every platform puts back), the bar carries an accent hairline while it
 * is in Community mode so the layer is visible at a glance, and the transition
 * is SYMMETRIC: the four destinations leave to the left and return from the
 * left, so the way out retraces the way in. That is Apple's spatial-consistency
 * rule, and it is what makes a morph read as a door rather than a shuffle.
 *
 * The motion is transform + opacity only, one 260ms curve, and reduced motion
 * gets a cross-fade instead of a slide — sliding panes are the specific thing
 * that causes spatial disorientation for people who asked not to be moved.
 */
export function MobileNav() {
  const badges = useNavBadges()
  const unread = useUnreadMessages()
  const { user } = useAppData()
  const t = useT()
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  const inCommunity = pathname.startsWith('/app/community')
  const raw = params.get('c')
  const section: CommunitySection = isCommunitySection(raw) ? raw : DEFAULT_SECTION

  return (
    <nav
      className={cn(
        'relative shrink-0 overflow-hidden border-t pb-[env(safe-area-inset-bottom)] md:hidden',
        // The layer you are in, stated in one pixel of colour rather than a
        // label that would cost a row of height.
        inCommunity ? 'border-accent/50' : 'border-border',
      )}
    >
      {/*
        THE FROSTED BAR IS ITS OWN LAYER, and this is a performance fix, not a
        style one. `backdrop-filter` used to sit on the <nav>, which made it an
        ANCESTOR of the moving rows — so every frame of the morph had to be
        re-composited through the blur instead of being a plain GPU transform.
        That is why the animation played but stuttered on a real phone.

        As a SIBLING, its backdrop is the page behind the bar, which does not
        change while the rows slide. The blur is computed once; the rows move
        above it for free.
      */}
      {/* Saturated, not just blurred. Blur alone drains the colour out of
          whatever is behind the bar, so the surface goes grey and reads as a
          translucent panel rather than as glass; the saturation is what every
          native frosted material does and what was missing here. It stays on
          this SIBLING layer — as an ancestor of the sliding rows it forced a
          re-composite through the filter on every frame, which is what made
          the tab morph stutter. */}
      <div
        className="absolute inset-0 bg-surface/85 backdrop-blur-xl backdrop-saturate-[180%]"
        aria-hidden
      />

      {/* Both rows are always mounted, both absolutely positioned inside a
          track of fixed height. Only transform and opacity ever change, so the
          bar cannot resize mid-transition and the browser never has to redo
          layout while it is animating. */}
      <div className="ct-navtrack relative">
        <Row shown={!inCommunity} from="left">
          {STUDENT_NAV.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors duration-150 active:scale-95',
                  isActive ? 'text-accent' : 'text-subtle',
                )
              }
            >
              {/* Badge floats over the icon so a count never shifts the bar. */}
              <span className="relative">
                <Icon size={20} aria-hidden />
                {badges[to] && (
                  <NavBadge
                    badge={badges[to]!}
                    className="absolute -top-1.5 -right-2.5 ring-2 ring-surface"
                  />
                )}
              </span>
              <span className="w-full truncate text-center tracking-tight">{t(labelKey)}</span>
            </NavLink>
          ))}
        </Row>

        <Row shown={inCommunity} from="right">
          {/* Leftmost, because that is where back lives on every platform a
              student has ever used. Going to Today rather than history: the bar
              is a place, not a stack, and `back` here means "out of Community". */}
          <Link
            to="/app"
            aria-label="Leave Social"
            className="flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] text-subtle transition-transform duration-150 active:scale-95"
          >
            <ArrowLeft size={20} aria-hidden />
            <span className="w-full truncate text-center tracking-tight">Back</span>
          </Link>

          {COMMUNITY_SECTIONS.map((s) => {
            const on = section === s.id
            /*
             * YOUR OWN SLOT IS YOUR FACE, not a person glyph over the word
             * "You". Every app a student already has does it this way, and
             * the reason is that a photo is recognised faster than a label
             * is read — it is the one item in the bar that does not need
             * naming. The ring is how it says "selected" without a colour
             * change, which a photo would swallow.
             *
             * IT IS AS TALL AS AN ICON PLUS ITS LABEL, not as tall as the
             * icon it replaced. A 22px face with an empty label under it
             * reserved the right amount of ROW but put the face itself at
             * the top of that space, so it sat level with the four icons
             * rather than level with the icon-and-word blocks beside it —
             * visibly high, and off centre. 36px is 20 (icon) + 4 (gap) +
             * 12 (label line), so it occupies exactly one slot's worth of
             * content and centres against its neighbours by construction.
             */
            if (s.id === 'profile') {
              return (
                <Link
                  key={s.id}
                  to={communityHref(s.id)}
                  aria-label={s.label}
                  aria-current={on ? 'page' : undefined}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center py-2 transition-transform duration-150 active:scale-95"
                >
                  <PersonAvatar
                    person={{
                      handle: user.handle ?? '',
                      name: user.name ?? null,
                      avatar_url: user.avatarUrl ?? null,
                    }}
                    className={cn(
                      'size-9 transition-shadow duration-150',
                      on && 'ring-2 ring-accent ring-offset-1 ring-offset-surface',
                    )}
                  />
                </Link>
              )
            }
            return (
              <Link
                key={s.id}
                to={communityHref(s.id)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors duration-150 active:scale-95',
                  on ? 'text-accent' : 'text-subtle',
                )}
              >
                <span className="relative">
                  <s.icon size={20} aria-hidden />
                  {/* A COUNT, not a dot. A dot says "something"; the number
                      is the difference between glancing and opening. Floated
                      over the icon so it can never shift the bar, and capped
                      at 9+ so the pill's width is stable. */}
                  {s.id === 'messages' && unread > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2.5 inline-flex min-w-[1.05rem] items-center justify-center rounded-full bg-accent px-1 py-px text-[10px] leading-none font-bold text-accent-contrast tabular-nums ring-2 ring-surface"
                      aria-label={`${unread} unread messages`}
                    >
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center tracking-tight">{s.label}</span>
              </Link>
            )
          })}
        </Row>
      </div>
    </nav>
  )
}

/**
 * One row of the bar.
 *
 * The hidden row is `inert` and `aria-hidden`, so a screen reader and the tab
 * order only ever see the row that is actually on screen — a bar with ten
 * reachable buttons when five are visible is worse than no animation at all.
 * It keeps its space (`absolute inset-0`) so the bar never changes height.
 */
function Row({
  shown,
  from,
  children,
}: {
  shown: boolean
  /** Which side it leaves toward, and returns from. Symmetric by construction. */
  from: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      className={cn(
        'ct-navrow flex items-stretch',
        shown ? 'ct-navrow-in' : from === 'left' ? 'ct-navrow-left' : 'ct-navrow-right',
      )}
    >
      {children}
    </div>
  )
}
