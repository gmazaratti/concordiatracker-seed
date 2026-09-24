import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/cn'
import { useInView } from './useInView'

/**
 * Fade + a 14px rise the first time an element enters the viewport.
 *
 * VISIBLE WHEN IT CANNOT ANIMATE. Under reduced motion the content is shown
 * from the first render, and `useInView` answers true where there is no way to
 * observe: a reveal that never fires must not leave a section invisible.
 *
 * `immediate` skips the viewport check and reveals one tick after mount, for
 * the hero, which is already on screen when the page loads.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  immediate = false,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  immediate?: boolean
  as?: 'div' | 'section' | 'article' | 'p' | 'h1' | 'h2'
}) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const inView = useInView(ref, 0.12)
  const [mounted, setMounted] = useState(false)

  // One tick, so the hidden state paints first and there is something to
  // transition from.
  useEffect(() => {
    if (!immediate) return
    const id = window.setTimeout(() => setMounted(true), 30)
    return () => window.clearTimeout(id)
  }, [immediate])

  const shown = reduced || (immediate ? mounted : inView)

  return (
    <Tag
      ref={(n: HTMLElement | null) => {
        ref.current = n
      }}
      data-revealed={shown ? 'true' : 'false'}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={cn(
        // `translate`, not `transform`: Tailwind v4's translate utilities set
        // the individual `translate` property, which a transform transition
        // would not animate.
        'transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3.5 opacity-0',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
