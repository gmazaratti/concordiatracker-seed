import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { orgSlug, type EventOrg } from '@/data/community'
import { cn } from '@/lib/cn'
import { OrgLogo } from './OrgLogo'
import { PersonAvatar } from './PersonAvatar'
import { VerifiedBadge } from './VerifiedBadge'
import { useCommunity } from './useCommunity'
import { searchPeople, type PublicPerson } from './profile-follows'
import {
  clearRecents,
  pushRecent,
  readRecents,
  removeRecent,
  type RecentEntry,
} from './recents'

/**
 * Search, as ONE thing.
 *
 * Community used to carry two search fields — a "find a club" box on Home and
 * another inside the events feed — plus the app's own magnifier in the top bar.
 * Three doors to two rooms. This is the single door: a bar at the top of the
 * section that opens the whole screen when you tap it.
 *
 * Full-screen is not decoration. A search that drops a list under a 40px field
 * gives you four visible results on a phone and hides the rest behind a scroll
 * inside a scroll. Taking the screen means the keyboard, the recents and the
 * results are the only three things on it.
 *
 * ORGS AND PEOPLE ARE ONE SEARCH, grouped under headings. Somebody typing
 * "CASA" does not necessarily know whether that is a club or a classmate, and
 * making them pick a scope first punishes them for not already knowing the
 * answer. Only PUBLIC profiles are searchable, enforced in the RPC.
 */
type Row = { kind: 'org'; org: EventOrg } | { kind: 'person'; person: PublicPerson }

/** The bar you tap. Looks like a field, behaves like a door — same as the one
 *  every phone app opens its search from. */
export function CommunitySearchBar({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-surface-2/70 px-3.5 py-2.5 text-left text-[13.5px] text-subtle',
          'transition-[background-color,border-color] duration-150 hover:border-border-strong active:bg-surface-2',
          className,
        )}
      >
        <Search size={16} className="shrink-0" aria-hidden />
        <span className="truncate">Search students and clubs</span>
      </button>
      {open && <SearchOverlay onClose={() => setOpen(false)} />}
    </>
  )
}

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { searchOrgs } = useCommunity()
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<PublicPerson[]>([])
  const [recents, setRecents] = useState<RecentEntry[]>(() => readRecents())

  /**
   * Focus the FIELD, not the back arrow.
   *
   * useModalDismiss focuses the first focusable, which is the back button —
   * correct for a dialog, wrong for a search screen, where the keyboard should
   * already be up. Both are `setTimeout(…, 0)` and this effect is declared
   * second, so this one runs last and wins.
   */
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [])

  // People come from the server: debounce, and drop stale responses so typing
  // fast cannot let an earlier query overwrite a later one.
  useEffect(() => {
    const q = query.trim()
    let alive = true
    const id = window.setTimeout(
      () => {
        if (!q) {
          if (alive) setPeople([])
          return
        }
        void searchPeople(q).then((rows) => {
          if (alive) setPeople(rows)
        })
      },
      q ? 180 : 0,
    )
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [query])

  const orgs = query.trim() ? searchOrgs(query) : []
  const rows: Row[] = [
    ...orgs.map((org) => ({ kind: 'org' as const, org })),
    ...people.map((person) => ({ kind: 'person' as const, person })),
  ]

  function go(row: Row) {
    if (row.kind === 'org') {
      pushRecent({ kind: 'org', handle: row.org.handle, name: row.org.name })
      navigate(`/app/community/org/${orgSlug(row.org)}`)
    } else {
      pushRecent({
        kind: 'person',
        handle: row.person.handle,
        name: row.person.name || `@${row.person.handle}`,
        avatar: row.person.avatar_url,
      })
      navigate(`/@${row.person.handle}`)
    }
    onClose()
  }

  function goRecent(r: RecentEntry) {
    // Re-stamped so the one you keep coming back to stays at the top.
    pushRecent({ kind: r.kind, handle: r.handle, name: r.name, avatar: r.avatar })
    const org = r.kind === 'org' ? searchOrgs(r.handle).find((o) => o.handle === r.handle) : undefined
    navigate(org ? `/app/community/org/${orgSlug(org)}` : `/@${r.handle.replace(/^@/, '')}`)
    onClose()
  }

  const searching = query.trim().length > 0

  return createPortal(
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Search Community"
      className="ct-sheet-in fixed inset-0 z-[90] flex flex-col bg-canvas"
    >
      <header className="flex shrink-0 items-center gap-2 px-3 pt-[calc(0.625rem_+_env(safe-area-inset-top))] pb-2.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="grid size-10 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2 active:scale-95"
        >
          <ArrowLeft size={20} aria-hidden />
        </button>
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students and clubs"
            aria-label="Search students and clubs"
            className="w-full rounded-full border border-transparent bg-surface-2 py-2.5 pr-9 pl-10 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-surface text-subtle transition-colors duration-150 hover:text-fg"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl px-2 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))]">
          {!searching ? (
            recents.length === 0 ? (
              <p className="px-3 py-14 text-center text-[13px] text-subtle">
                Search a classmate's handle or a club's name. What you open shows up here next
                time.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1">
                  <h2 className="text-[15px] font-semibold text-fg">Recent</h2>
                  <button
                    type="button"
                    onClick={() => setRecents(clearRecents())}
                    className="text-[13px] font-medium text-accent transition-opacity duration-150 hover:opacity-80"
                  >
                    Clear all
                  </button>
                </div>
                <ul>
                  {recents.map((r) => (
                    <li key={`${r.kind}-${r.handle}`} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => goRecent(r)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2"
                      >
                        <RecentIcon entry={r} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-fg">
                            {r.name}
                          </span>
                          <span className="block truncate text-[12.5px] text-subtle">
                            {r.kind === 'org' ? r.handle : `@${r.handle}`}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${r.name} from recent searches`}
                        onClick={() => setRecents(removeRecent(r.kind, r.handle))}
                        className="grid size-9 shrink-0 place-items-center rounded-full text-subtle transition-colors duration-150 hover:text-fg"
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : rows.length === 0 ? (
            <p className="px-3 py-14 text-center text-[13px] text-subtle">
              Nothing matching “{query.trim()}”. Handles are exact; names are not.
            </p>
          ) : (
            <ul>
              {rows.map((row, i) => {
                const heading =
                  i === 0 && row.kind === 'org'
                    ? 'Organizations'
                    : i === orgs.length && row.kind === 'person'
                      ? 'People'
                      : null
                return (
                  <li key={row.kind === 'org' ? `o-${row.org.handle}` : `p-${row.person.handle}`}>
                    {heading && (
                      <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                        {heading}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => go(row)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2"
                    >
                      {row.kind === 'org' ? (
                        <>
                          <OrgLogo
                            org={row.org}
                            className="size-10"
                            rounded="rounded-xl"
                            textClass="text-[12px]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 text-[14px] font-medium text-fg">
                              <span className="truncate">{row.org.name}</span>
                              {row.org.verified && <VerifiedBadge size={13} />}
                            </span>
                            <span className="block truncate text-[12.5px] text-subtle">
                              {row.org.handle}
                            </span>
                          </span>
                        </>
                      ) : (
                        <>
                          <PersonAvatar person={row.person} className="size-10" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-fg">
                              {row.person.name || `@${row.person.handle}`}
                            </span>
                            <span className="block truncate text-[12.5px] text-subtle">
                              @{row.person.handle}
                              {row.person.program ? ` · ${row.person.program}` : ''}
                            </span>
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** A recent org keeps its logo if we still know it; otherwise initials. */
function RecentIcon({ entry }: { entry: RecentEntry }) {
  const { orgs } = useCommunity()
  if (entry.kind === 'org') {
    const org = orgs.find((o) => o.handle === entry.handle)
    return org ? (
      <OrgLogo org={org} className="size-10" rounded="rounded-xl" textClass="text-[12px]" />
    ) : (
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-[12px] font-semibold text-subtle">
        {entry.name.slice(0, 2).toUpperCase()}
      </span>
    )
  }
  return (
    <PersonAvatar
      person={{ handle: entry.handle, name: entry.name, avatar_url: entry.avatar ?? null }}
      className="size-10"
    />
  )
}
