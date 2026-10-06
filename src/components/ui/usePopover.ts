import { useEffect, useRef, useState } from 'react'

/** A small panel under a toolbar button, portaled so the toolbar's horizontal
 *  scroll never clips it, and closed by Escape or a click elsewhere. */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  /** Measured when it opens, not in an effect, so the panel never paints at 0,0. */
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect()
    if (r) setPos({ left: Math.min(r.left, window.innerWidth - 260), top: r.bottom + 6 })
    setOpen((o) => !o)
  }
  return { open, setOpen, toggle, btnRef: btn, panelRef: panel, pos }
}
