import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { orgSlug, type EventOrg } from '@/data/community'
import { cn } from '@/lib/cn'
import { OrgLogo } from './OrgLogo'
import { VerifiedBadge } from './VerifiedBadge'
import { useCommunity } from './useCommunity'
import { searchPeople, type PublicPerson } from './profile-follows'

/**
 * One search box over BOTH organizations and people, with results grouped under
 * headings rather than split behind a scope toggle.
 *
 * The reasoning: a student typing "CASA" doesn't necessarily know whether it's
 * an org or a person, and making them choose a scope first is friction that
 * punishes them for not already knowing the answer. Grouping teaches the
 * distinction instead of demanding it.
 *
 * Only PUBLIC profiles are searchable — that's enforced in the RPC, not here.
 */

type Row =
  | { kind: 'org'; org: EventOrg }
  | { kind: 'person'; person: PublicPerson }

export function CommunitySearch() {
  const navigate = useNavigate()
  const { searchOrgs } = useCommunity()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<PublicPerson[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const orgs = query.trim() ? searchOrgs(query) : []

  // People come from the server, so debounce and drop stale responses — typing
  // fast must not let an earlier query overwrite a later one.
  useEffect(() => {
    const q = query.trim()
    let alive = true
    // Every path settles through a timer, so no setState runs synchronously in
    // the effect body — an empty query just clears on the next tick.
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

  // Flat list for keyboard nav; the headings are rendered around it.
  const rows: Row[] = [
    ...orgs.map((org) => ({ kind: 'org' as const, org })),
    ...people.map((person) => ({ kind: 'person' as const, person })),
  ]
  const showList = open && rows.length > 0

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function go(row: Row) {
    navigate(
      row.kind === 'org'
        ? `/app/community/org/${orgSlug(row.org)}`
        : `/@${row.person.handle}`,
    )
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else if (rows.length) setActive((a) => (a + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length) setActive((a) => (a - 1 + rows.length) % rows.length)
    } else if (e.key === 'Enter' && showList) {
      e.preventDefault()
      const row = rows[active]
      if (row) go(row)
    } else if (e.key === 'Escape') {
      if (query) setQuery('')
      else setOpen(false)
    }
  }

  const orgCount = orgs.length

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <Search
        size={15}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
      />
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-opt-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search people and organizations"
        className="w-full rounded-lg border border-border bg-surface py-2 pr-8 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery('')
            setOpen(false)
          }}
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <X size={14} aria-hidden />
        </button>
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl"
        >
          {rows.map((row, i) => {
            // Headings appear only when that group actually has results, so an
            // orgs-only search doesn't render an empty "People" label.
            const heading =
              i === 0 && row.kind === 'org'
                ? 'Organizations'
                : i === orgCount && row.kind === 'person'
                  ? 'People'
                  : null
            return (
              <li key={row.kind === 'org' ? `o-${row.org.handle}` : `p-${row.person.handle}`}>
                {heading && (
                  <p
                    // Presentational: the option list must stay flat for a11y.
                    role="presentation"
                    className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase"
                  >
                    {heading}
                  </p>
                )}
                <div
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    go(row)
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2',
                    i === active && 'bg-surface-2',
                  )}
                >
                  {row.kind === 'org' ? (
                    <>
                      <OrgLogo org={row.org} className="size-8" rounded="rounded-md" textClass="text-[11px]" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-[13px] font-medium text-fg">
                          <span className="truncate">{row.org.name}</span>
                          {row.org.verified && <VerifiedBadge size={13} />}
                        </span>
                        <span className="block truncate text-[12px] text-subtle">{row.org.handle}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <PersonAvatar person={row.person} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-fg">
                          {row.person.name || `@${row.person.handle}`}
                        </span>
                        <span className="block truncate text-[12px] text-subtle">
                          @{row.person.handle}
                          {row.person.program ? ` · ${row.person.program}` : ''}
                        </span>
                      </span>
                      {row.person.follower_count > 0 && (
                        <span className="shrink-0 text-[11px] tabular-nums text-subtle">
                          {row.person.follower_count}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Round avatar — visually distinct from an org's rounded-square logo, so the
 * two groups read differently even at a glance. */
export function PersonAvatar({
  person,
  className = 'size-8',
}: {
  person: Pick<PublicPerson, 'handle' | 'name' | 'avatar_url'>
  className?: string
}) {
  const initials =
    (person.name ?? person.handle)
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  return person.avatar_url ? (
    <img
      src={person.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
      className={cn('shrink-0 rounded-full bg-surface-2 object-cover', className)}
    />
  ) : (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent',
        className,
      )}
    >
      {initials}
    </span>
  )
}
