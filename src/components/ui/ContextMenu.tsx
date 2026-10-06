import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MenuItem } from './DropdownMenu'
import { cn } from '@/lib/cn'

/**
 * A right-click menu, opened at the pointer.
 *
 * Portaled and fixed, so it is never clipped by a scrolling grid, and moved
 * back inside the window after it has measured itself (a menu opened near the
 * right or bottom edge flips to the other side of the pointer instead of
 * running off screen). Same keyboard model as DropdownMenu: arrows move,
 * Enter selects, Escape closes, and the first item has focus on open.
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
  label,
}: {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [active, setActive] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    setPos({
      left: x + r.width > vw - 8 ? Math.max(8, x - r.width) : x,
      top: y + r.height > vh - 8 ? Math.max(8, y - r.height) : y,
    })
  }, [x, y])

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const scroll = () => onClose()
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', scroll)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', scroll)
    }
  }, [onClose])

  const focusAt = (i: number) => {
    const n = (i + items.length) % items.length
    setActive(n)
    ref.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]')[n]?.focus()
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          focusAt(active + 1)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          focusAt(active - 1)
        } else if (e.key === 'Tab') {
          e.preventDefault()
        }
      }}
      style={{ left: pos.left, top: pos.top }}
      className="ct-animate-pop fixed z-[200] min-w-48 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl"
    >
      {items.map((it, i) => {
        const Icon = it.icon
        return (
          <div key={it.id}>
            {it.separated && <div className="my-1 h-px bg-border" />}
            <button
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                onClose()
                it.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] outline-none',
                it.danger ? 'text-danger' : 'text-fg',
                i === active && (it.danger ? 'bg-danger/10' : 'bg-surface-2'),
              )}
            >
              {Icon && <Icon size={15} className={it.danger ? '' : 'text-muted'} aria-hidden />}
              {it.label}
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
