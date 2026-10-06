import { forwardRef, useImperativeHandle, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { cn } from '@/lib/cn'
import type { MentionItem } from './mention-items'

export interface MentionListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean
}

/** The "@" menu: arrows move, Enter or Tab picks, Escape closes (handled by the plugin). */
export const MentionList = forwardRef<MentionListHandle, { items: MentionItem[]; command: (item: MentionItem) => void; loading?: boolean }>(
  function MentionList({ items, command, loading }, ref) {
    const [index, setIndex] = useState(0)
    const [prevItems, setPrevItems] = useState(items)
    if (prevItems !== items) {
      setPrevItems(items)
      setIndex(0)
    }
    useImperativeHandle(ref, () => ({
      onKeyDown: (e) => {
        if (!items.length) return false
        if (e.key === 'ArrowDown') { setIndex((i) => (i + 1) % items.length); return true }
        if (e.key === 'ArrowUp') { setIndex((i) => (i - 1 + items.length) % items.length); return true }
        if (e.key === 'Enter' || e.key === 'Tab') { command(items[index]); return true }
        return false
      },
    }))

    if (!items.length) {
      return <div className="w-64 rounded-xl border border-border bg-surface p-3 text-[12.5px] text-subtle shadow-xl">{loading ? 'Searching…' : 'Nobody by that name.'}</div>
    }
    let lastKind = ''
    return (
      <div role="listbox" aria-label="Mention" className="flex w-72 flex-col overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
        {items.map((it, i) => {
          const heading = it.kind !== lastKind ? (it.kind === 'date' ? 'Dates' : 'People') : null
          lastKind = it.kind
          return (
            <div key={it.id}>
              {heading && <p className="px-3 pt-1.5 pb-0.5 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">{heading}</p>}
              <button type="button" role="option" aria-selected={i === index}
                onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setIndex(i)} onClick={() => command(it)}
                className={cn('flex w-full items-center gap-2.5 px-3 py-1.5 text-left', i === index && 'bg-surface-2')}>
                {it.kind === 'date' ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><CalendarClock size={14} aria-hidden /></span>
                ) : (
                  <PersonAvatar person={{ name: it.label, handle: it.handle ?? '', avatar_url: it.avatar }} className="size-7 shrink-0" />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] text-fg">{it.label}</span>
                  {(it.hint || (it.kind === 'person' && it.handle)) && (
                    <span className={cn('truncate text-[11.5px]', it.kind === 'person' && !it.access ? 'text-subtle' : 'text-muted')}>
                      {it.kind === 'person' && it.handle ? `@${it.handle} · ` : ''}{it.hint}
                    </span>
                  )}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    )
  },
)
