import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { useTransitionClick } from '@/lib/view-transition'
import { haptic } from '@/lib/haptics'
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
import { cn } from '@/lib/cn'

/**
 * The phone's tab bar: a FLOATING GLASS PILL over the page (the Instagram
 * shape), not a strip under it.
 *
 * WHY THE OLD BAR NEVER LOOKED LIKE GLASS, even though it carried a
 * backdrop blur: it sat IN FLOW, below <main>, so the page never scrolled
 * behind it. A blur of nothing is a flat colour. The pill is `position:
 * fixed` over the scroller, and the page gets a spacer at its end (index.css,
 * `--ct-pill-pad`) so the last row can still scroll out from under it.
 *
 * WHY IT RENDERS ON-DEVICE NOW. The material is one hand-written class
 * (`.ct-glass-pill`) with LITERAL values for both `-webkit-backdrop-filter`
 * and `backdrop-filter`. The old one went through Tailwind's utility, which
 * composes the filter from a chain of `var()` fallbacks; the prefixed
 * property is what iOS 17's WebKit reads, and it is the one to keep
 * unambiguous. The blur sits on a SIBLING layer of the icons, never an
 * ancestor, so the morph between the two rows below stays a plain GPU
 * transform instead of re-compositing through the filter every frame.
 *
 * TWO STATES, as before. Normally the five destinations. Inside Community it
 * becomes Community's own bar — Back, Feed, Events, Messages, You — with the
 * same symmetric slide (the way out retraces the way in).
 *
 * ICONS ONLY. Each slot is labelled for VoiceOver; on screen the active tab
 * carries a lighter capsule behind its icon, and anything waiting for you is
 * a red dot on the icon.
 */
export function MobileNav() {
  const badges = useNavBadges()
  const unread = useUnreadMessages()
  const { user } = useAppData()
  const t = useT()
  const transition = useTransitionClick()
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  const inCommunity = pathname.startsWith('/app/community')
  const raw = params.get('c')
  const section: CommunitySection = isCommunitySection(raw) ? raw : DEFAULT_SECTION

  return (
    <div className="ct-mobile-pill pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 md:hidden">
      <nav aria-label="Main" className="pointer-events-auto relative w-full max-w-[26rem] overflow-hidden rounded-full">
        <div className="ct-glass-pill absolute inset-0 rounded-full" aria-hidden />

        <div className="ct-navtrack relative">
          <Row shown={!inCommunity} from="left">
            {STUDENT_NAV.map(({ to, labelKey, icon: Icon, end }) => {
              const badge = badges[to]
              const dot = !!badge || (to === '/app/community' && unread > 0)
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  aria-label={t(labelKey) + (badge ? `, ${badge.label}` : '')}
                  onClick={(e) => {
                    haptic('tap')
                    transition(to, 'tab')(e)
                  }}
                  className="group flex min-w-0 flex-1 items-center justify-center"
                >
                  {({ isActive }) => (
                    <Slot active={isActive} dot={dot}>
                      <Icon size={24} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                    </Slot>
                  )}
                </NavLink>
              )
            })}
          </Row>

          <Row shown={inCommunity} from="right">
            {/* Leftmost, where back lives on every platform. "Back" here means
                out of Community, to Today: the bar is a place, not a stack. */}
            <Link to="/app" aria-label="Leave Social" className="flex min-w-0 flex-1 items-center justify-center">
              <Slot active={false} dot={false}>
                <ArrowLeft size={24} aria-hidden />
              </Slot>
            </Link>

            {COMMUNITY_SECTIONS.map((s) => {
              const on = section === s.id
              if (s.id === 'profile') {
                return (
                  <Link
                    key={s.id}
                    to={communityHref(s.id)}
                    aria-label={s.label}
                    aria-current={on ? 'page' : undefined}
                    className="flex min-w-0 flex-1 items-center justify-center"
                  >
                    <Slot active={on} dot={false}>
                      {/* Your face, not a person glyph: it is recognised faster
                          than any label is read. */}
                      <PersonAvatar
                        person={{
                          handle: user.handle ?? '',
                          name: user.name ?? null,
                          avatar_url: user.avatarUrl ?? null,
                        }}
                        className={cn('size-7', on && 'ring-2 ring-white/90')}
                      />
                    </Slot>
                  </Link>
                )
              }
              const count = s.id === 'messages' ? unread : 0
              return (
                <Link
                  key={s.id}
                  to={communityHref(s.id)}
                  aria-current={on ? 'page' : undefined}
                  aria-label={s.label + (count ? `, ${count} unread` : '')}
                  className="flex min-w-0 flex-1 items-center justify-center"
                >
                  <Slot active={on} dot={count > 0}>
                    <s.icon size={24} strokeWidth={on ? 2.4 : 2} aria-hidden />
                  </Slot>
                </Link>
              )
            })}
          </Row>
        </div>
      </nav>
    </div>
  )
}

/**
 * One tab: the icon, the lighter capsule behind it when it is the current
 * tab, and a red dot when something is waiting.
 */
function Slot({ active, dot, children }: { active: boolean; dot: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'relative grid h-[48px] w-full max-w-[74px] place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-[0.92]',
        active ? 'ct-glass-active text-[var(--ct-glass-ink)]' : 'text-[var(--ct-glass-ink-dim)]',
      )}
    >
      <span className="relative grid place-items-center">
        {children}
        {dot && (
          <span
            className="absolute -right-1 -bottom-0.5 size-[9px] rounded-full bg-[#ff3b30] ring-[1.5px] ring-[var(--ct-glass-ring)]"
            aria-hidden
          />
        )}
      </span>
    </span>
  )
}

/**
 * One row of the pill. The hidden row is `inert` and `aria-hidden`, so a
 * screen reader and the tab order only ever see the row on screen. It keeps its
 * space (`absolute inset-0`) so the pill never changes height.
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
        'ct-navrow flex items-center gap-0.5 px-1.5',
        shown ? 'ct-navrow-in' : from === 'left' ? 'ct-navrow-left' : 'ct-navrow-right',
      )}
    >
      {children}
    </div>
  )
}
