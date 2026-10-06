import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** "Bold (Ctrl+B)" reads as "Bold  ⌘B" on a Mac. */
function display(label: string): { name: string; keys: string | null } {
  const m = label.match(/^(.*?)\s*\((.+)\)$/)
  if (!m) return { name: label, keys: null }
  const keys = MAC ? m[2].replace(/Ctrl\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥') : m[2]
  return { name: m[1], keys }
}

/**
 * Names for icon buttons, shown on hover — one listener for a whole region
 * instead of a tooltip component wrapped around every button.
 *
 * Anything inside an element with the class `ct-tips` that has an aria-label
 * gets one, after a short pause so moving across a toolbar does not flash a
 * row of labels. Rendered into the body so a scrolling toolbar cannot clip it.
 */
export function HoverTips() {
  const [tip, setTip] = useState<{ label: string; x: number; y: number; below: boolean } | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let current: Element | null = null
    const clear = () => {
      if (timer) clearTimeout(timer)
      timer = null
      current = null
      setTip(null)
    }
    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const el = (e.target as Element | null)?.closest?.('.ct-tips [aria-label]:is(button, a, input, [role=button], [role=combobox], [role=img])')
      if (el === current) return
      clear()
      if (!el) return
      current = el
      timer = setTimeout(() => {
        const label = el.getAttribute('aria-label')
        if (!label || el.getAttribute('aria-expanded') === 'true') return
        const r = el.getBoundingClientRect()
        const below = r.bottom + 40 < window.innerHeight
        setTip({ label, x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below })
      }, 450)
    }
    window.addEventListener('pointerover', over)
    window.addEventListener('pointerdown', clear, true)
    window.addEventListener('scroll', clear, true)
    window.addEventListener('keydown', clear)
    return () => {
      clear()
      window.removeEventListener('pointerover', over)
      window.removeEventListener('pointerdown', clear, true)
      window.removeEventListener('scroll', clear, true)
      window.removeEventListener('keydown', clear)
    }
  }, [])

  if (!tip) return null
  const { name, keys } = display(tip.label)
  return createPortal(
    <div role="tooltip"
      style={{ left: Math.max(8, Math.min(window.innerWidth - 8, tip.x)), top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}
      className="ct-animate-fade pointer-events-none fixed z-[220] flex items-center gap-2 rounded-md bg-fg px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-canvas shadow-lg">
      {name}
      {keys && <span className="opacity-60">{keys}</span>}
    </div>,
    document.body,
  )
}
