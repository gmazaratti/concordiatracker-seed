import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * A small panel under a chip in the text, portaled so the page cannot clip
 * it. Closes on Escape or a click outside it (a click inside a date picker
 * that is itself portaled counts as inside: those carry data-portal-popover).
 */
export function ChipPopover({ anchor, onClose, children, label }: {
  anchor: HTMLElement | null
  onClose: () => void
  children: React.ReactNode
  label: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })

  useLayoutEffect(() => {
    if (!anchor || !panel.current) return
    const r = anchor.getBoundingClientRect()
    const p = panel.current.getBoundingClientRect()
    const below = r.bottom + 8 + p.height < window.innerHeight
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - p.width - 8)),
      top: below ? r.bottom + 6 : Math.max(8, r.top - p.height - 6),
    })
  }, [anchor])

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (panel.current?.contains(t) || anchor?.contains(t) || t.closest?.('[role=dialog],[role=listbox]')) return
      onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
    }
  }, [anchor, onClose])

  return createPortal(
    <div ref={panel} role="dialog" aria-label={label} style={pos}
      className="ct-animate-pop fixed z-[190] w-72 rounded-xl border border-border bg-surface p-3 text-left shadow-xl">
      {children}
    </div>,
    document.body,
  )
}
