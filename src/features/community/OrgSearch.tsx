import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { searchOrgs, orgSlug, type EventOrg } from '@/data/community'
import { cn } from '@/lib/cn'
import { OrgLogo } from './OrgLogo'
import { VerifiedBadge } from './VerifiedBadge'

/** Search organizations by name or handle (like the blueprint search). Results
 * link to org profile pages. Keyboard-accessible combobox (↑/↓/Enter/Esc). */
export function OrgSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const results = query.trim() ? searchOrgs(query) : []
  const showList = open && results.length > 0

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function go(org: EventOrg) {
    navigate(`/app/community/org/${orgSlug(org)}`)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((a) => (a + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + results.length) % results.length)
    } else if (e.key === 'Enter' && showList) {
      e.preventDefault()
      const org = results[active]
      if (org) go(org)
    } else if (e.key === 'Escape') {
      if (query) setQuery('')
      else setOpen(false)
    }
  }

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
        placeholder="Search organizations by name or handle"
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
          {results.map((org, i) => (
            <li
              key={org.handle}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                go(org)
              }}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2',
                i === active ? 'bg-surface-2' : '',
              )}
            >
              <OrgLogo org={org} className="size-8" rounded="rounded-md" textClass="text-[11px]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[13px] font-medium text-fg">
                  <span className="truncate">{org.name}</span>
                  {org.verified && <VerifiedBadge size={13} />}
                </span>
                <span className="block truncate text-[12px] text-subtle">{org.handle}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
