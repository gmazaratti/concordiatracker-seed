import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/**
 * Reveals text a few characters at a time whenever it CHANGES — the visible
 * feedback that a fresh briefing was just worked out. Driven by JS timers (not a
 * CSS width trick), because the UI font is proportional and a ch-based reveal
 * mis-renders.
 *
 * Reduced-motion safe: settles on the full string immediately.
 */
export function useTypewriter(text: string, { speed = 12, delay = 0 } = {}): {
  shown: string
  typing: boolean
} {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(text)
  const timers = useRef<number[]>([])

  useEffect(() => {
    for (const t of timers.current) window.clearTimeout(t)
    timers.current = []

    if (reduced || !text) {
      // Settle via a 0ms timeout rather than a synchronous setState in the
      // effect body (which the lint rules disallow, and which would double-render).
      timers.current.push(window.setTimeout(() => setShown(text), 0))
      return () => {
        for (const t of timers.current) window.clearTimeout(t)
      }
    }

    timers.current.push(window.setTimeout(() => setShown(''), 0))
    // Step several characters at a time so long paragraphs don't crawl.
    const step = Math.max(1, Math.round(text.length / 90))
    for (let i = step; i <= text.length; i += step) {
      const end = Math.min(i, text.length)
      timers.current.push(
        window.setTimeout(() => setShown(text.slice(0, end)), delay + (i / step) * speed),
      )
    }
    // Guarantee the final state even if the loop's last step lands short.
    timers.current.push(
      window.setTimeout(() => setShown(text), delay + (text.length / step + 1) * speed),
    )

    return () => {
      for (const t of timers.current) window.clearTimeout(t)
      timers.current = []
    }
  }, [text, speed, delay, reduced])

  return { shown, typing: shown.length < text.length }
}
