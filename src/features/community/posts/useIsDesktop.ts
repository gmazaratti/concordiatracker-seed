import { useEffect, useState } from 'react'

const QUERY = '(min-width: 1024px)'

/** True at desktop width (1024px and up), following the window as it resizes. */
export function useIsDesktop(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = (e: MediaQueryListEvent) => setWide(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}
