import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RoleGlyph } from '../RoleChip'
import { ROLE_ICONS } from '../role-icons'
import { cn } from '@/lib/cn'

const NAMES = Object.keys(ROLE_ICONS)
const COLS = 6

/**
 * The role's icon: one square button beside the name, opening a grid.
 *
 * PORTALED AND FIXED, like the colour picker next to it, so the middle rail's
 * own scroll region cannot clip it. Arrow keys move through the grid, Enter
 * picks, Escape closes and hands focus back to the button — `stopPropagation`
 * so the Escape closes this and not whatever the page is inside.
 */
export function IconPicker({
  value,
  color,
  onChange,
  disabled,
}: {
  value: string
  color: string
  onChange: (name: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [active, setActive] = useState(Math.max(0, NAMES.indexOf(value)))
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const r = btn.current!.getBoundingClientRect()
      const w = 268
      setPos({
        top: Math.min(r.bottom + 6, window.innerHeight - 250),
        left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])

  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLButtonElement>(`[data-i="${active}"]`)?.focus()
  }, [open, active])

  function key(e: React.KeyboardEvent) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }
    if (e.key in moves) {
      e.preventDefault()
      setActive((a) => Math.min(NAMES.length - 1, Math.max(0, a + moves[e.key])))
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
      btn.current?.focus()
    }
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        onClick={() => {
          setActive(Math.max(0, NAMES.indexOf(value)))
          setOpen((o) => !o)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Icon: ${value}. Change icon`}
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 transition-colors hover:border-border-strong disabled:opacity-60"
        style={{ color }}
      >
        <RoleGlyph role={{ icon: value, color }} bare />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label="Choose an icon"
            onKeyDown={key}
            className="ct-animate-pop fixed z-[200] w-[268px] rounded-xl border border-border bg-surface p-2 shadow-2xl"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="grid grid-cols-6 gap-1">
              {NAMES.map((n, i) => (
                <button
                  key={n}
                  type="button"
                  data-i={i}
                  tabIndex={i === active ? 0 : -1}
                  aria-label={n}
                  aria-pressed={n === value}
                  onClick={() => {
                    onChange(n)
                    setOpen(false)
                    btn.current?.focus()
                  }}
                  className={cn(
                    'grid size-10 place-items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent',
                    n === value ? 'bg-accent-soft' : 'hover:bg-surface-2',
                  )}
                  style={{ color: n === value ? color : undefined }}
                >
                  <RoleGlyph role={{ icon: n, color: 'currentColor' }} bare />
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
