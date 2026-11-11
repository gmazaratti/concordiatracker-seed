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
 * icon, a live dot and a full-width button say "this one is for you, do it".
 * It never shares a day with the popup, so loud here is not loud twice.
 */
export function DiscoverCard() {
  const { card, follow, snooze } = useDiscovery()
  const navigate = useNavigate()
  if (!card) return null

  return (
    <section
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
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-accent uppercase">
        <span className="relative flex size-2">
          <span className="ct-discover-ping absolute inline-flex size-full rounded-full bg-accent" />
          <span className="relative inline-flex size-2 rounded-full bg-accent" />
        </span>
        Picked for you
      </p>
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
