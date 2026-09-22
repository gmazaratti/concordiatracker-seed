import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { followList, setFollow, type FollowRow } from '@/lib/social-graph'
import { useCommunity } from '@/features/community/useCommunity'
import { useFollows } from '@/app/providers/follows'
import { OrgLogo } from '@/features/community/OrgLogo'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { badgeForPerson } from './badges'
import { cn } from '@/lib/cn'

export type FollowListKind = 'followers' | 'following' | 'orgs'

const TABS: { id: FollowListKind; label: string }[] = [
  { id: 'orgs', label: 'orgs' },
  { id: 'followers', label: 'followers' },
  { id: 'following', label: 'following' },
]

/**
 * Followers / Following / Orgs, full screen.
 *
 * IT WAS A DIALOG AND THE BOTTOM WAS CUT OFF. A centred `sm:max-w-md` card
 * with `max-h-[80vh]` is the wrong container for a list that can run to
 * hundreds: the last rows sat under the phone's home bar with no way to reach
 * them. This is a page — `fixed inset-0`, `h-[100dvh]` (the layout viewport
 * does not move with the browser's own chrome, `dvh` does), and a single
 * scroll region between a fixed header and the safe-area inset.
 *
 * THE THREE LISTS ARE TABS, not three separate openings. Instagram does this
 * because the question is almost never one of them in isolation — you open
 * Followers and immediately want to know whether you follow them back. Each
 * tab carries its count in the label for the same reason.
 */
export function FollowListPage({
  handle,
  kind,
  onClose,
}: {
  handle: string
  kind: FollowListKind
  onClose: () => void
}) {
  const [tab, setTab] = useState<FollowListKind>(kind)
  const [q, setQ] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex h-[100dvh] flex-col bg-canvas"
      role="dialog"
      aria-modal="true"
    >
      <header className="shrink-0 border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="grid size-9 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2"
          >
            <ArrowLeft size={19} aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-fg">
            {handle}
          </p>
          <span className="size-9 shrink-0" />
        </div>

        {/* Tabs, with the active one underlined — the reference's shape. */}
        <div className="flex overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 border-b-2 px-3 pb-2.5 text-[14px] transition-colors duration-150',
                tab === t.id
                  ? 'border-fg font-semibold text-fg'
                  : 'border-transparent text-subtle hover:text-muted',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="shrink-0 px-3 pt-3">
        <div className="relative">
          <Search
            size={15}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username or display name"
            aria-label="Search"
            className="w-full rounded-lg border border-border bg-surface-2 py-2.5 pr-3 pl-9 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {tab === 'orgs' ? (
          <OrgList q={q} onClose={onClose} />
        ) : (
          <PeopleList handle={handle} kind={tab} q={q} onClose={onClose} />
        )}
      </div>
    </div>,
    document.body,
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-12 text-center text-[13px] text-subtle">{children}</p>
}

function PeopleList({
  handle,
  kind,
  q,
  onClose,
}: {
  handle: string
  kind: 'followers' | 'following'
  q: string
  onClose: () => void
}) {
  const [rows, setRows] = useState<FollowRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState('')
  const [local, setLocal] = useState<Record<string, boolean>>({})

  // Reset during render when the tab changes — an effect that setStates on
  // mount renders twice and trips react-hooks/set-state-in-effect.
  const [shownFor, setShownFor] = useState(kind)
  if (shownFor !== kind) {
    setShownFor(kind)
    setRows(null)
    setFailed(false)
  }

  useEffect(() => {
    let alive = true
    void followList(handle, kind)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [handle, kind])

  if (failed) return <Empty>Could not load that list.</Empty>
  if (!rows) return <Empty>Loading…</Empty>

  const term = q.trim().toLowerCase()
  const shown = term
    ? rows.filter(
        (r) => r.handle.toLowerCase().includes(term) || (r.name ?? '').toLowerCase().includes(term),
      )
    : rows

  if (shown.length === 0) return <Empty>{term ? 'Nobody by that name.' : 'Nobody yet.'}</Empty>

  const toggle = async (r: FollowRow) => {
    const next = !(local[r.handle] ?? r.i_follow)
    setBusy(r.handle)
    setLocal((p) => ({ ...p, [r.handle]: next }))
    const ok = await setFollow(r.handle, next)
    // The database refuses a blocked pair; put the button back rather than
    // leave it claiming something that did not happen.
    if (!ok) setLocal((p) => ({ ...p, [r.handle]: !next }))
    setBusy('')
  }

  return (
    <ul className="flex flex-col">
      {shown.map((r) => {
        const following = local[r.handle] ?? r.i_follow
        return (
          <li key={r.handle} className="flex items-center gap-3 px-3 py-2">
            <Link
              to={`/@${r.handle}`}
              onClick={onClose}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <Avatar name={r.name} handle={r.handle} url={r.avatar_url} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-fg">{r.handle}</span>
                {r.name && (
                  <span className="block truncate text-[12.5px] text-subtle">{r.name}</span>
                )}
              </span>
            </Link>
            {!r.is_me && (
              <button
                type="button"
                disabled={busy === r.handle}
                onClick={() => void toggle(r)}
                className={cn(
                  'shrink-0 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 disabled:opacity-60',
                  following
                    ? 'bg-surface-2 text-fg hover:bg-surface'
                    : 'bg-accent text-accent-contrast hover:bg-accent-hover',
                )}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Orgs come from the already-loaded community data — no round trip. */
function OrgList({ q, onClose }: { q: string; onClose: () => void }) {
  const { orgs } = useCommunity()
  const { followedHandles, toggleFollow } = useFollows()
  const term = q.trim().toLowerCase()
  const mine = orgs.filter((o) => followedHandles.includes(o.handle))
  const shown = term
    ? mine.filter(
        (o) => o.name.toLowerCase().includes(term) || o.handle.toLowerCase().includes(term),
      )
    : mine

  if (shown.length === 0) return <Empty>{term ? 'No match.' : 'Not following any clubs yet.'}</Empty>

  return (
    <ul className="flex flex-col">
      {shown.map((o) => (
        <li key={o.handle} className="flex items-center gap-3 px-3 py-2">
          <Link
            to={`/app/community/org/${o.handle.replace(/^@/, '')}`}
            onClick={onClose}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <OrgLogo org={o} className="size-11 shrink-0" rounded="rounded-full" />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[13.5px] font-medium text-fg">
                <span className="truncate">{o.handle}</span>
                {o.verified && <VerifiedBadge size={13} />}
              </span>
              <span className="block truncate text-[12.5px] text-subtle">{o.name}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => toggleFollow(o.handle)}
            className="shrink-0 rounded-lg bg-surface-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-fg transition-colors duration-150 hover:bg-surface"
          >
            Following
          </button>
        </li>
      ))}
    </ul>
  )
}

function Avatar({
  name,
  handle,
  url,
}: {
  name: string | null
  handle: string
  url: string | null
}) {
  const badge = badgeForPerson(handle, undefined)
  const initials = (name ?? handle).slice(0, 2).toUpperCase()
  return (
    <span className="relative shrink-0">
      {url ? (
        <img src={url} alt="" className="size-11 rounded-full bg-surface-2 object-cover" />
      ) : (
        <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-muted">
          {initials}
        </span>
      )}
      {badge && (
        <span className="absolute -right-0.5 -bottom-0.5">
          <VerifiedBadge size={13} tone={badge.tone} label={badge.label} />
        </span>
      )}
    </span>
  )
}
