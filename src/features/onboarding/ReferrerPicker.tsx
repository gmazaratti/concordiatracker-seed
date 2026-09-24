import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchPeople, type PublicPerson } from '@/features/community/profile-follows'
import { initialsOf } from '@/lib/initials'

/**
 * "Which friend?" — optional, shown under "A friend" in onboarding.
 *
 * Stores the chosen person's HANDLE (what the search returns; it never hands
 * out user ids). Only people discoverable in search can be picked, which is
 * the right limit: a private profile is not one we surface to a stranger.
 */
export function ReferrerPicker({ value, onChange }: { value?: string; onChange: (handle: string | undefined) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PublicPerson[]>([])
  const [picked, setPicked] = useState<PublicPerson | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    let alive = true
    const id = setTimeout(() => {
      void searchPeople(term, 6).then((r) => alive && setResults(r))
    }, 220)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [q])

  const face = (p: { avatar_url: string | null; name: string | null; handle: string }, size = 32) =>
    p.avatar_url ? (
      <img src={p.avatar_url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    ) : (
      <span className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted" style={{ width: size, height: size }}>
        {initialsOf(p.name, p.handle)}
      </span>
    )

  if (value) {
    const shown = picked && picked.handle.toLowerCase() === value.toLowerCase() ? picked : null
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent/50 bg-accent-soft px-3 py-2.5 text-left">
        {shown ? face(shown, 34) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-subtle">Referred by</span>
          <span className="block truncate text-[14px] font-medium text-fg">
            {shown?.name || `@${value}`} {shown?.name && <span className="font-normal text-subtle">@{value}</span>}
          </span>
        </span>
        <button type="button" onClick={() => onChange(undefined)} aria-label="Remove referrer" className="grid size-8 place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-fg">
          <X size={16} aria-hidden />
        </button>
      </div>
    )
  }

  const list = q.trim().length >= 2 ? results : []
  return (
    <div className="mt-3 text-left">
      <label htmlFor="heard-friend" className="mb-1.5 block text-[12.5px] font-medium text-fg">
        Who told you about it? <span className="font-normal text-subtle">(optional)</span>
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 focus-within:border-accent">
        <Search size={15} className="shrink-0 text-subtle" aria-hidden />
        <input
          id="heard-friend"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a name or @handle"
          autoFocus
          className="w-full bg-transparent py-2 text-[13.5px] text-fg placeholder:text-subtle focus:outline-none"
        />
      </div>
      {list.length > 0 && (
        <ul className="mt-1.5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {list.map((p) => (
            <li key={p.handle}>
              <button
                type="button"
                onClick={() => {
                  setPicked(p)
                  onChange(p.handle)
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2"
              >
                {face(p)}
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-fg">{p.name || `@${p.handle}`}</span>
                  <span className="block truncate text-[12px] text-subtle">@{p.handle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && list.length === 0 && (
        <p className="mt-1.5 text-[12px] text-subtle">No one found. Only public profiles show up here.</p>
      )}
    </div>
  )
}
