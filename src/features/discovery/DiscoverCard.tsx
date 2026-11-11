import { useLayoutEffect, useRef } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDiscovery } from './useDiscovery'
import { NudgeIcon } from './NudgeIcon'

/**
 * Today's "try this next" card: ONE feature this student has not used, chosen
 * for them (lib/discovery.ts). Gone the day they use it; "Not now" brings the
 * next-best one and rests this one for three days.
 *
 * It is the loudest thing in the rail ON PURPOSE. The first version matched the
 * panels around it and nobody would have clicked it: an accent wash, a filled
 * icon and a full-width button say "this one is for you, do it".
 * It never shares a day with the popup, so loud here is not loud twice.
 *
 * A card you have not seen this session ARRIVES: it appears in the middle of
 * the screen, holds a beat, and drops into its place in the rail, so the eye
 * follows it there. Once per card per session; never under reduced motion, and
 * never when its place is off screen (a phone, where the rail is below).
 */
export function DiscoverCard() {
  const { card, follow, snooze } = useDiscovery()
  const navigate = useNavigate()
  const ref = useRef<HTMLElement>(null)
  const id = card?.id
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !id) return
    const key = `ct_discover_flown_${id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-reduce-motion')) return
    const r = el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > window.innerHeight) return
    const dx = window.innerWidth / 2 - (r.left + r.width / 2)
    const dy = window.innerHeight / 2 - (r.top + r.height / 2)
    const centre = `translate(${dx}px, ${dy}px) scale(1.12)`
    el.style.zIndex = '40'
    const fly = el.animate(
      [
        { transform: `${centre} scale(0.9)`, opacity: 0 },
        { transform: centre, opacity: 1, offset: 0.2 },
        { transform: centre, opacity: 1, offset: 0.5 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 1300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
    let landed = false
    fly.onfinish = () => {
      landed = true
      el.style.zIndex = ''
    }
    return () => {
      el.style.zIndex = ''
      // Cut short (the dev double-mount, or leaving the page mid-flight): it
      // has not been seen arriving, so it may arrive next time.
      if (!landed) {
        fly.cancel()
        try {
          sessionStorage.removeItem(key)
        } catch {
          /* nothing to undo */
        }
      }
    }
  }, [id])
  if (!card) return null

  return (
    <section
      ref={ref}
      key={card.id}
      aria-label="Something to try"
      className="ct-discover-card relative overflow-hidden rounded-2xl border border-accent/60 bg-gradient-to-br from-accent/25 via-accent/10 to-surface p-4 shadow-[0_8px_28px_-12px_var(--ct-accent)]"
    >
      <span className="ct-discover-sheen pointer-events-none absolute inset-x-0 top-0 h-[2px]" aria-hidden />
      <button
        type="button"
        onClick={() => snooze(card.id)}
        aria-label="Not now"
        title="Not now"
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        <X size={14} aria-hidden />
      </button>
      <p className="text-[11px] font-bold tracking-[0.12em] text-accent uppercase">Picked for you</p>
      <div className="mt-2.5 flex items-start gap-3">
        <span className="ct-discover-icon grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-contrast shadow-lg">
          <NudgeIcon icon={card.icon} size={21} />
        </span>
        <p className="min-w-0 pr-5 text-[16px] leading-snug font-bold text-fg">{card.title}</p>
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{card.body}</p>
      <button
        type="button"
        onClick={() => {
          follow(card.id)
          navigate(card.to)
        }}
        className="group mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[14px] font-bold text-accent-contrast transition-all duration-150 hover:bg-accent-hover active:scale-[0.98]"
      >
        {card.cta}
        <ArrowRight size={15} className="transition-transform duration-150 group-hover:translate-x-1" aria-hidden />
      </button>
    </section>
  )
}
