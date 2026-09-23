import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Flag, Info, Reply } from 'lucide-react'
import { REACTIONS } from '@/lib/message-extras'
import { cn } from '@/lib/cn'

export interface MenuAction {
  onReact: (emoji: string) => void
  onReply: () => void
  onInfo: () => void
  onCopy?: () => void
  /** Only on the other person's messages: you do not report yourself. */
  onReport?: () => void
  /** Your current reaction, so the row can show it picked. */
  mine?: string | null
}

/**
 * What a right-click (or a long press on a phone) on a message offers.
 *
 * PORTALED AND FIXED at the pointer, clamped to the screen, so a message near
 * the bottom of the thread opens its menu upward rather than off the edge.
 * Escape and any click outside close it; the arrow keys move through it.
 */
export function MessageMenu({ x, y, onClose, ...a }: MenuAction & { x: number; y: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      top: y + h + 8 > window.innerHeight ? Math.max(8, y - h) : y,
    })
    el.querySelector<HTMLButtonElement>('[data-item]')?.focus()
  }, [x, y])

  useEffect(() => {
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[data-item]') ?? [])]
        const i = items.indexOf(document.activeElement as HTMLButtonElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }
    }
    // Next tick, so the press that opened the menu does not also close it.
    const t = setTimeout(() => document.addEventListener('pointerdown', down), 0)
    document.addEventListener('keydown', key, true)
    const scroll = () => onClose()
    window.addEventListener('resize', scroll)
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key, true)
      window.removeEventListener('resize', scroll)
    }
  }, [onClose])

  const run = (fn: () => void) => () => {
    onClose()
    fn()
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Message actions"
      className="ct-animate-pop fixed z-[95] w-[232px] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      style={pos}
    >
      <div className="flex justify-between border-b border-border px-1.5 py-1.5">
        {REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`React ${e}`}
            aria-pressed={a.mine === e}
            onClick={run(() => a.onReact(e))}
            className={cn(
              'grid size-7 place-items-center rounded-full text-[17px] transition-transform duration-150 hover:scale-125',
              a.mine === e && 'bg-accent-soft',
            )}
          >
            {e}
          </button>
        ))}
      </div>
      <Item icon={Reply} label="Reply" onClick={run(a.onReply)} />
      {a.onCopy && <Item icon={Copy} label="Copy text" onClick={run(a.onCopy)} />}
      <Item icon={Info} label="Info" onClick={run(a.onInfo)} />
      {a.onReport && <Item icon={Flag} label="Report" danger onClick={run(a.onReport)} />}
    </div>,
    document.body,
  )
}

function Item({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: typeof Reply
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-item
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none',
        danger ? 'text-danger' : 'text-fg',
      )}
    >
      <Icon size={15} aria-hidden />
      {label}
    </button>
  )
}
