import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { haptic } from '@/lib/haptics'

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

type Pos = { left: number; top: number; maxWidth: number }

const PAD = 8

/**
 * Where the menu goes, from the trigger's rect and the menu's REAL size.
 *
 * It used to pin the menu's right edge to the trigger's right edge and never
 * look at the other side. On a trigger near the left of the screen (the `+`
 * on your own profile) that put the menu's left edge ~130px off-screen, and
 * on iOS a fixed element hanging off the page drags the whole view sideways.
 * Now: prefer aligning right edges; if that would leave the screen, align left
 * edges instead; then clamp into what is VISIBLE (the visual viewport, which
 * on iOS can be narrower than the layout viewport and offset inside it).
 * Vertically: below the trigger, or above it when there is no room, and never
 * past either edge.
 */
function place(trigger: DOMRect, w: number, h: number): Pos {
  const vv = window.visualViewport
  const vLeft = vv?.offsetLeft ?? 0
  const vTop = vv?.offsetTop ?? 0
  const vW = vv?.width ?? window.innerWidth
  const vH = vv?.height ?? window.innerHeight
  const maxWidth = Math.max(160, vW - PAD * 2)
  const width = Math.min(w, maxWidth)
  let left = trigger.right - width
  if (left < vLeft + PAD) left = trigger.left
  left = Math.min(Math.max(left, vLeft + PAD), vLeft + vW - width - PAD)
  const below = trigger.bottom + 4
  const above = trigger.top - 4 - h
  let top = below + h > vTop + vH - PAD && above >= vTop + PAD ? above : below
  top = Math.min(Math.max(top, vTop + PAD), Math.max(vTop + PAD, vTop + vH - h - PAD))
  return { left: Math.round(left), top: Math.round(top), maxWidth: Math.round(maxWidth) }
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
  icon: Icon = MoreVertical,
}: {
  items: MenuItem[]
  ariaLabel: string
  triggerClassName?: string
  disabled?: boolean
  /** Trigger glyph (defaults to the vertical ⋮). */
  icon?: LucideIcon
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [active, setActive] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const openMenu = (last = false) => {
    if (!triggerRef.current) return
    // Placed after it renders (below), once its real size is known. Until
    // then it is laid out invisibly so the measurement is honest.
    setPos(null)
    setActive(last ? items.length - 1 : 0)
    setOpen(true)
  }

  const measure = () => {
    const t = triggerRef.current
    const m = menuRef.current
    if (!t || !m) return
    setPos(place(t.getBoundingClientRect(), m.offsetWidth, m.offsetHeight))
  }

  // Before paint, so the menu never flashes in the wrong place.
  useLayoutEffect(() => {
    if (open) measure()
  }, [open])
  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }
  const select = (i: number) => {
    setOpen(false)
    triggerRef.current?.focus()
    // A destructive item (Delete) warns in the hand as well as in red.
    if (items[i]?.danger) haptic('warning')
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
    const reposition = () => measure()
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
        <Icon size={16} aria-hidden />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={ariaLabel}
            onKeyDown={onMenuKeyDown}
            style={
              pos
                ? { position: 'fixed', left: pos.left, top: pos.top, maxWidth: pos.maxWidth }
                : { position: 'fixed', left: 0, top: 0, visibility: 'hidden' }
            }
            className="ct-animate-pop z-[200] min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-2xl"
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
