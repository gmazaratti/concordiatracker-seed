import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ModalShell } from '@/command/ModalShell'
import { followList, setFollow, type FollowRow } from '@/lib/social-graph'
import { useCommunity } from '@/features/community/useCommunity'
import { useFollows } from '@/app/providers/follows'
import { OrgLogo } from '@/features/community/OrgLogo'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { badgeForPerson } from './badges'
import { useCommunityData } from '@/app/providers/community-data'
import { cn } from '@/lib/cn'

export type FollowListKind = 'followers' | 'following' | 'orgs'

const TITLE: Record<FollowListKind, string> = {
  followers: 'Followers',
  following: 'Following',
  orgs: 'Orgs',
}

/**
 * The list behind a count — followers, following, or the orgs they follow.
 *
 * A COUNT YOU CANNOT OPEN IS DECORATION. The three numbers on a profile are
 * the only way into the graph, so each one is a button and each one lands
 * here. Same modal for all three because they are the same shape of answer:
 * a searchable list of accounts with a follow control on each row.
 *
 * Search is client-side over the loaded page on purpose — these lists are
 * small (a student's followers, not a celebrity's), and a debounced server
 * round-trip per keystroke would be slower than the thing it replaced.
 */
export function FollowListModal({
  handle,
  kind,
  onClose,
}: {
  handle: string
  kind: FollowListKind
  onClose: () => void
}) {
  const [rows, setRows] = useState<FollowRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (kind === 'orgs') return
    let alive = true
    void followList(handle, kind)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [handle, kind])

  return (
    <ModalShell label={TITLE[kind]} onClose={onClose} widthClass="sm:max-w-md">
      <div className="flex max-h-[80vh] flex-col">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-center text-[15px] font-semibold text-fg">{TITLE[kind]}</h2>
        </div>
        <div className="px-3 pt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label={`Search ${TITLE[kind]}`}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          {kind === 'orgs' ? (
            <OrgList q={q} />
          ) : failed ? (
            <Empty>Could not load that list.</Empty>
          ) : !rows ? (
            <Empty>Loading…</Empty>
          ) : (
            <PeopleList rows={rows} q={q} onClose={onClose} />
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-[13px] text-subtle">{children}</p>
}

function PeopleList({
  rows,
  q,
  onClose,
}: {
  rows: FollowRow[]
  q: string
  onClose: () => void
}) {
  const [busy, setBusy] = useState('')
  const [local, setLocal] = useState<Record<string, boolean>>({})
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
            <Link to={`/@${r.handle}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={r.name} handle={r.handle} url={r.avatar_url} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-fg">{r.handle}</span>
                {r.name && <span className="block truncate text-[12.5px] text-subtle">{r.name}</span>}
              </span>
            </Link>
            {!r.is_me && (
              <button
                type="button"
                disabled={busy === r.handle}
                onClick={() => void toggle(r)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 disabled:opacity-60',
                  following
                    ? 'border border-border bg-surface text-fg hover:border-border-strong'
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
function OrgList({ q }: { q: string }) {
  const { orgs } = useCommunity()
  const { followedHandles, toggleFollow } = useFollows()
  const term = q.trim().toLowerCase()
  const mine = orgs.filter((o) => followedHandles.includes(o.handle))
  const shown = term
    ? mine.filter((o) => o.name.toLowerCase().includes(term) || o.handle.toLowerCase().includes(term))
    : mine

  if (shown.length === 0) return <Empty>{term ? 'No match.' : 'Not following any clubs yet.'}</Empty>

  return (
    <ul className="flex flex-col">
      {shown.map((o) => (
        <li key={o.handle} className="flex items-center gap-3 px-3 py-2">
          <Link to={`/app/community/org/${o.handle.replace(/^@/, '')}`} className="flex min-w-0 flex-1 items-center gap-3">
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
            className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-fg transition-colors duration-150 hover:border-border-strong"
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
  const { orgNameByOwner } = useCommunityData()
  const badge = badgeForPerson(handle, undefined)
  void orgNameByOwner
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
