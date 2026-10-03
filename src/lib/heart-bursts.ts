import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The big heart that pops where you double-tapped a post or a story.
 *
 * Each burst is removed on a TIMER, not on `animationend`: under reduced
 * motion the global rule zeroes animation durations, and a burst that waited
 * for its animation to finish would rely on an event this preview pane (and
 * some browsers in a background tab) never fires.
 */
export interface HeartBurstItem {
  id: number
  /** Position inside the element that drew it, in px. */
  x: number
  y: number
  /** true = liked (filled heart), false = unliked (outline). */
  on: boolean
}

const LIFE_MS = 850

export function useHeartBursts() {
  const [bursts, setBursts] = useState<HeartBurstItem[]>([])
  const seq = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  const burst = useCallback((x: number, y: number, on: boolean) => {
    const id = ++seq.current
    setBursts((b) => [...b, { id, x, y, on }])
    timers.current.push(window.setTimeout(() => setBursts((b) => b.filter((h) => h.id !== id)), LIFE_MS))
  }, [])

  return { bursts, burst }
}

/** Two taps count as one double-tap inside this window and this distance. */
export const DOUBLE_TAP_MS = 300
export const DOUBLE_TAP_PX = 40
