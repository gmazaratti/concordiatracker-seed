import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'

/** The questions the search bar types out while it is empty. */
export const SEARCH_PROMPTS = [
  'Find me an advisor',
  'When are the drop dates',
  'Help with a paper',
  'How do I get to Loyola',
  'Who do I ask about fees',
  'Someone to talk to',
  'Bursaries and scholarships',
  'What to do in first year',
]

const TYPE_MS = 55
const ERASE_MS = 28
const HOLD_MS = 1900
const GAP_MS = 350

/**
 * A placeholder that types a phrase, holds it, erases it and moves to the
 * next, like someone trying questions. It stops while `paused` (the field has
 * focus or text), and with reduced motion it is simply the first phrase.
 * Timers only: nothing here depends on a CSS animation finishing.
 */
export function useTypedPlaceholder(phrases: string[], paused: boolean): string {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)
  const [erasing, setErasing] = useState(false)

  useEffect(() => {
    if (reduced || paused) return
    const phrase = phrases[index % phrases.length]
    let delay = erasing ? ERASE_MS : TYPE_MS
    if (!erasing && count === phrase.length) delay = HOLD_MS
    if (erasing && count === 0) delay = GAP_MS
    const id = window.setTimeout(() => {
      if (!erasing && count === phrase.length) setErasing(true)
      else if (erasing && count === 0) {
        setErasing(false)
        setIndex((i) => (i + 1) % phrases.length)
      } else setCount((c) => c + (erasing ? -1 : 1))
    }, delay)
    return () => window.clearTimeout(id)
  }, [reduced, paused, phrases, index, count, erasing])

  if (reduced) return phrases[0]
  return phrases[index % phrases.length].slice(0, count)
}
