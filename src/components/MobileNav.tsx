import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
import { PillRow, type PillItem } from './nav/PillRow'
import { cn } from '@/lib/cn'

/**
 * The phone's tab bar: a floating glass pill over the page, Instagram's shape.
 *
 * RENDERED AT THE ROOT (a portal into <body>), not inside the page's column.
 * And tab switches no longer use the View Transitions API: that API snapshots
 * the page and draws the incoming snapshot over EVERYTHING, pill included —
 * which is exactly the half-second dip behind the new page in build 11. The
 * page now fades in on its own (StudentLayout), and the pill is never part of
 * a snapshot, so it stays live, on top, with its real blur, the whole time.
 *
 * THE GLASS is `.ct-glass-pill` (index.css): one hand-written rule with plain
 * `-webkit-backdrop-filter` and `backdrop-filter` values, a low fill so the
 * page genuinely shows through, and an edge highlight. The pill floats with
 * a margin on every side and the page scrolls underneath it (`--ct-pill-pad`).
 *
 * TWO ROWS: the five destinations, and — inside Community — Back, Feed,
 * Events, Messages, You. They swap with one slide (`ct-navrow`); each row's
 * capsule slides between its tabs on a spring, and a press-and-drag scrubs
 * through them (components/nav/PillRow).
 */
const GLASS: React.CSSProperties = {
  WebkitBackdropFilter: 'blur(30px) saturate(175%)',
  backdropFilter: 'blur(30px) saturate(175%)',
}

export function MobileNav() {
  const badges = useNavBadges()
  const unread = useUnreadMessages()
  const { user } = useAppData()
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  const inCommunity = pathname.startsWith('/app/community')
  const raw = params.get('c')
  const section: CommunitySection = isCommunitySection(raw) ? raw : DEFAULT_SECTION

  const mobileNav = STUDENT_NAV.filter((n) => !n.desktopOnly)
  const main: PillItem[] = mobileNav.map(({ to, labelKey, icon: Icon }) => {
    const badge = badges[to]
    return {
      key: to,
      to,
      label: t(labelKey) + (badge ? `, ${badge.label}` : ''),
      dot: !!badge || (to === '/app/community' && unread > 0),
      render: (on) => <Icon size={24} strokeWidth={on ? 2.4 : 1.9} aria-hidden />,
    }
  })
  const mainActive = mobileNav.findIndex((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))

  const community: PillItem[] = [
    {
      key: 'back',
      to: '/app',
      label: 'Leave Social',
      render: () => <ArrowLeft size={24} strokeWidth={1.9} aria-hidden />,
    },
    ...COMMUNITY_SECTIONS.map((s): PillItem => {
      if (s.id === 'profile') {
        return {
          key: s.id,
          to: communityHref(s.id),
          label: s.label,
          // Your face, not a glyph: it is recognised faster than a label.
          render: (on) => (
            <PersonAvatar
              person={{ handle: user.handle ?? '', name: user.name ?? null, avatar_url: user.avatarUrl ?? null }}
              className={cn('size-7 transition-shadow duration-200', on && 'ring-2 ring-[var(--ct-glass-ink)]')}
            />
          ),
        }
      }
      const count = s.id === 'messages' ? unread : 0
      return {
        key: s.id,
        to: communityHref(s.id),
        label: s.label + (count ? `, ${count} unread` : ''),
        dot: count > 0,
        render: (on) => <s.icon size={24} strokeWidth={on ? 2.4 : 1.9} aria-hidden />,
      }
    }),
  ]
  const communityActive = 1 + COMMUNITY_SECTIONS.findIndex((s) => s.id === section)

  const go = (item: PillItem) => navigate(item.to)

  return createPortal(
    <div className="ct-mobile-pill pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 md:hidden">
      <nav aria-label="Main" className="pointer-events-auto relative w-full max-w-[26rem] overflow-hidden rounded-full">
        {/* The filter is ALSO set inline, as the exact plain string: the CSS
            rule is minified at build (to `blur(30px)saturate(175%)`), which is
            valid, but an inline style is never rewritten — so what reaches
            WKWebView is literally this. */}
        <div className="ct-glass-pill absolute inset-0 rounded-full" style={GLASS} aria-hidden />
        <div className="ct-navtrack relative">
          <Row shown={!inCommunity} from="left">
            <PillRow items={main} active={mainActive} onCommit={go} />
          </Row>
          <Row shown={inCommunity} from="right">
            <PillRow items={community} active={communityActive} onCommit={go} />
          </Row>
        </div>
      </nav>
    </div>,
    document.body,
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
      className={cn('ct-navrow', shown ? 'ct-navrow-in' : from === 'left' ? 'ct-navrow-left' : 'ct-navrow-right')}
    >
      {children}
    </div>
  )
}
