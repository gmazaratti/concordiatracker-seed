import { useMemo, useState } from 'react'
import { Clock, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EMOJI_GROUPS, searchEmoji } from '@/lib/emoji-data'

const RECENT_KEY = 'ct_recent_emoji'

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 16) : []
  } catch {
    return []
  }
}

function remember(e: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...readRecent().filter((x) => x !== e)].slice(0, 16)))
  } catch {
    /* a convenience, not a record */
  }
}

/**
 * Emoji, searchable by name and grouped like a phone keyboard, with the ones
 * you used last on top. The panel only; the caller decides where it floats.
 */
export function EmojiPicker({ onPick, autoFocus = true }: { onPick: (emoji: string) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState(EMOJI_GROUPS[0].id)
  const [recent, setRecent] = useState(readRecent)
  const results = useMemo(() => searchEmoji(q), [q])
  const shown = q.trim() ? results : (EMOJI_GROUPS.find((g) => g.id === group)?.items ?? [])

  const pick = (e: string) => {
    remember(e)
    setRecent(readRecent())
    onPick(e)
  }

  return (
    <div className="flex w-[19rem] flex-col gap-2">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 focus-within:border-accent">
        <Search size={14} className="shrink-0 text-subtle" aria-hidden />
        <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emoji"
          aria-label="Search emoji" className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle" />
      </label>
      {!q.trim() && recent.length > 0 && (
        <div className="flex items-center gap-1 overflow-hidden" aria-label="Recently used">
          <Clock size={13} className="mr-0.5 shrink-0 text-subtle" aria-hidden />
          {recent.slice(0, 9).map((e) => (
            <button key={e} type="button" onClick={() => pick(e)} aria-label={e}
              className="grid size-7 shrink-0 place-items-center rounded-md text-[18px] hover:bg-surface-2">{e}</button>
          ))}
        </div>
      )}
      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto pr-1" role="listbox" aria-label="Emoji">
        {shown.map((it) => (
          <button key={it.e} type="button" role="option" aria-selected={false} onClick={() => pick(it.e)}
            title={it.k.split(' ')[0]} aria-label={it.k.split(' ')[0]}
            className="grid size-8 place-items-center rounded-md text-[20px] transition-transform duration-100 hover:scale-110 hover:bg-surface-2">
            {it.e}
          </button>
        ))}
        {q.trim() && results.length === 0 && <p className="col-span-8 py-6 text-center text-[12.5px] text-subtle">No emoji called that.</p>}
      </div>
      {!q.trim() && (
        <div className="flex gap-0.5 border-t border-border pt-1.5" role="tablist" aria-label="Emoji groups">
          {EMOJI_GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={g.id === group} onClick={() => setGroup(g.id)} title={g.label}
              className={cn('grid h-7 flex-1 place-items-center rounded-md text-[16px]', g.id === group ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
              {g.items[0].e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
