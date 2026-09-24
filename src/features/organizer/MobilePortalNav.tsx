import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The organizer portal's phone tab bar: a strip that scrolls sideways.
 *
 * Ten sections do not fit in 375px, so the strip scrolls inside itself — and
 * with nothing to say so, the tabs past the edge looked like they did not
 * exist. A fade on the edge that still has more is the affordance every phone
 * uses: the right edge while there is more to the right, the left edge once you
 * have scrolled. It reads the real scroll position, so it disappears at the end
 * rather than promising tabs that are not there.
 */
export function MobilePortalNav({
  items,
}: {
  items: { to: string; label: string; icon: LucideIcon; end?: boolean }[]
}) {
  const ref = useRef<HTMLElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth
      setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft < max - 2 })
    }
    // The active tab may start past the edge (Roles, Activity); bring it into
    // view once, without animating the page.
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [items.length])

  return (
    <div className="relative border-t border-border bg-surface md:hidden">
      <nav
        ref={ref}
        className="flex overflow-x-auto pb-[env(safe-area-inset-bottom)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium whitespace-nowrap transition-colors duration-150',
                isActive ? 'text-accent' : 'text-subtle',
              )
            }
          >
            <Icon size={19} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent transition-opacity duration-200',
          edges.left ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent transition-opacity duration-200',
          edges.right ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
