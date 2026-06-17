import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface MenuItem {
  id: string
  label: string
  icon?: LucideIcon
  onSelect: () => void
  /** Destructive styling (red). */
  danger?: boolean
  /** Draw a divider above this item (e.g. before Delete). */
  separated?: boolean
}

type Pos = { right: number; top?: number; bottom?: number }

/** Estimate the menu height to decide whether to flip upward, then anchor the
 * menu's right edge to the trigger's right edge (fixed-positioned). */
function computePos(el: HTMLElement, items: MenuItem[]): Pos {
  const r = el.getBoundingClientRect()
  const seps = items.filter((i) => i.separated).length
  const estH = items.length * 32 + seps * 9 + 10
  const spaceBelow = window.innerHeight - r.bottom
  const flipUp = spaceBelow < estH + 8 && r.top > spaceBelow
  const right = Math.max(8, Math.round(window.innerWidth - r.right))
  return flipUp
    ? { right, bottom: Math.round(window.innerHeight - r.top + 4) }
    : { right, top: Math.round(r.bottom + 4) }
}

/**
 * The reusable overflow ("⋮") menu — a floating, portaled popover anchored to its
 * trigger that never reflows the list. Closes on outside-click / Escape (one open
 * at a time, since opening another trigger's mousedown dismisses this one). Full
 * menu-button keyboard model: ↓/↑/Home/End move, Enter/Space select, Esc closes
 * and restores focus to the trigger, Tab is trapped. Flips up near the viewport
 * bottom so it's never clipped.
 */
export function DropdownMenu({
  items,
  ariaLabel,
  triggerClassName,
  disabled = false,
}: {
  items: MenuItem[]
  ariaLabel: string
  triggerClassName?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [active, setActive] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const openMenu = (last = false) => {
    const el = triggerRef.current
    if (!el) return
    setPos(computePos(el, items))
    setActive(last ? items.length - 1 : 0)
    setOpen(true)
  }
  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }
  const select = (i: number) => {
    setOpen(false)
    triggerRef.current?.focus()
    items[i]?.onSelect()
  }

  // Move DOM focus to the active item (roving tabindex) when open / active changes.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.focus()
  }, [open, active])

  // Reposition on scroll/resize + dismiss on outside mousedown.
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      const el = triggerRef.current
      if (el) setPos(computePos(el, items))
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false) // outside click: leave focus where the user clicked
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, items])

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (open) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openMenu(false)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu(true)
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const move = (delta: number) =>
      setActive((a) => (a + delta + items.length) % items.length)
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'Home': e.preventDefault(); setActive(0); break
      case 'End': e.preventDefault(); setActive(items.length - 1); break
      case 'Tab': e.preventDefault(); move(e.shiftKey ? -1 : 1); break // trap
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(true); break
      case 'Enter':
      case ' ': e.preventDefault(); select(active); break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        data-state={open ? 'open' : 'closed'}
        onClick={() => (open ? close(false) : openMenu(false))}
        onKeyDown={onTriggerKeyDown}
        className={triggerClassName}
      >
        <MoreVertical size={16} aria-hidden />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={ariaLabel}
            onKeyDown={onMenuKeyDown}
            style={{ position: 'fixed', right: pos.right, top: pos.top, bottom: pos.bottom }}
            className="ct-animate-pop z-[70] min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-2xl"
          >
            {items.map((it, i) => (
              <div key={it.id}>
                {it.separated && <div className="my-1 border-t border-border" />}
                <button
                  data-i={i}
                  role="menuitem"
                  type="button"
                  tabIndex={i === active ? 0 : -1}
                  onClick={() => select(i)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none transition-colors duration-150',
                    it.danger
                      ? 'text-danger hover:bg-danger/10 focus:bg-danger/10'
                      : 'text-muted hover:bg-surface-2 hover:text-fg focus:bg-surface-2 focus:text-fg',
                  )}
                >
                  {it.icon && <it.icon size={14} aria-hidden />}
                  {it.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
