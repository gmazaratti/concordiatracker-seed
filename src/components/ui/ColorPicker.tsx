import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** A tasteful spread of brand-friendly swatches across the hue wheel + a few
 * Concordia-ish tones. The hex field below covers any colour not in the grid. */
const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  '#912338', '#9b2335', '#1f4e8c', '#22b8a6', '#4fb89a', '#e0853c',
]

const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s)

type Pos = { left: number; top: number; above: boolean }

/**
 * Custom, token-themed colour picker — the in-house replacement for the native
 * `<input type="color">` (which renders the OS dialog). A swatch trigger opens a
 * portaled (fixed) popover with a palette grid + a hex field, so it never clips
 * and matches the rest of the design system. Works in `#rrggbb` hex.
 */
export function ColorPicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (hex: string) => void
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [hex, setHex] = useState(value)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const above = spaceBelow < 280 && r.top > spaceBelow
    setPos({ left: r.left, top: above ? r.top - 4 : r.bottom + 4, above })
  }, [])

  useEffect(() => {
    if (!open) return
    const reposition = () => place()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, place])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setHex(value) // reflect the current colour when (re)opening
    place()
    setOpen(true)
  }

  function pick(c: string) {
    onChange(c)
    setOpen(false)
  }

  function onHexInput(raw: string) {
    const next = raw.startsWith('#') ? raw : `#${raw}`
    setHex(next)
    if (isHex(next)) onChange(next.toLowerCase())
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2 py-1.5 transition-colors duration-150 hover:border-border-strong"
      >
        <span
          className="size-5 shrink-0 rounded-md border border-border-strong"
          style={{ backgroundColor: isHex(value) ? value : '#000' }}
          aria-hidden
        />
        <span className="font-mono text-[12px] text-fg">{value}</span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              left: pos.left,
              ...(pos.above ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            className="ct-animate-pop z-[60] w-[228px] rounded-xl border border-border bg-surface p-3 shadow-2xl"
          >
            <div className="grid grid-cols-6 gap-1.5">
              {PALETTE.map((c) => {
                const selected = c.toLowerCase() === value.toLowerCase()
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => pick(c)}
                    aria-label={c}
                    title={c}
                    className={cn(
                      'grid size-7 place-items-center rounded-md border transition-transform duration-100 hover:scale-110',
                      selected ? 'border-fg' : 'border-border-strong',
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {selected && <Check size={13} className="text-white drop-shadow" aria-hidden />}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span
                className="size-7 shrink-0 rounded-md border border-border-strong"
                style={{ backgroundColor: isHex(hex) ? hex : '#000' }}
                aria-hidden
              />
              <input
                value={hex}
                onChange={(e) => onHexInput(e.target.value)}
                spellCheck={false}
                aria-label="Hex colour"
                placeholder="#5b9cf6"
                className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-[12px] text-fg focus:border-accent focus:outline-none"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
