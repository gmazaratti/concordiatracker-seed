import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react'
import type { Guide } from '@/data/guides'
import { PHOTOS } from '@/data/resource-photos'
import { cn } from '@/lib/cn'

/**
 * The guides, as a shelf of tall photo cards. Each card is a real photograph
 * washed in the guide's own colour, so the row reads as a set and no two look
 * alike. The first card is the one written for your stage.
 */
export function GuideShelf({ guides, onRead, lead }: { guides: Guide[]; onRead: (slug: string) => void; lead: string }) {
  const row = useRef<HTMLDivElement>(null)
  const nudge = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  // Which sides have more cards off screen. A card cut off by the edge fades
  // out there instead of ending on a hard line, and the fade goes away at the
  // end of the row, so it never dims a card that is fully in view.
  const [more, setMore] = useState({ left: false, right: false })
  useEffect(() => {
    const el = row.current
    if (!el) return
    const update = () => {
      const left = el.scrollLeft > 4
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
      setMore((m) => (m.left === left && m.right === right ? m : { left, right }))
    }
    const first = window.setTimeout(update, 0)
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      window.clearTimeout(first)
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [guides.length])
  const FADE = 72
  const mask = `linear-gradient(to right, ${more.left ? 'transparent' : '#000'} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${more.right ? 'transparent' : '#000'} 100%)`
  return (
    <section aria-labelledby="res-guides">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id="res-guides" className="font-display text-[22px] font-semibold tracking-tight text-fg">
            Guides
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">{lead}</p>
        </div>
        <div className="hidden shrink-0 gap-1.5 sm:flex">
          <Arrow onClick={() => nudge(-1)} label="Scroll guides back">
            <ArrowLeft size={16} aria-hidden />
          </Arrow>
          <Arrow onClick={() => nudge(1)} label="Scroll guides forward">
            <ArrowRight size={16} aria-hidden />
          </Arrow>
        </div>
      </div>
      <div
        ref={row}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-1 sm:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {guides.map((g, i) => (
          <GuideCard key={g.slug} g={g} onRead={onRead} delay={Math.min(i, 6) * 60} wide={i === 0} />
        ))}
      </div>
    </section>
  )
}

export function GuideCard({
  g,
  onRead,
  delay = 0,
  wide,
  fill,
}: {
  g: Guide
  onRead: (slug: string) => void
  delay?: number
  /** The first card on the shelf is wider. */
  wide?: boolean
  /** Fill the parent instead of using the shelf's fixed size. */
  fill?: boolean
}) {
  const photo = PHOTOS[g.photo]
  return (
    <button
      type="button"
      onClick={() => onRead(g.slug)}
      className={cn(
        'ct-res-in group relative isolate flex shrink-0 snap-start flex-col justify-end overflow-hidden rounded-3xl p-5 text-left text-white transition-transform duration-300 hover:-translate-y-1 active:scale-[0.985]',
        fill ? 'size-full min-h-[300px]' : cn('h-[380px]', wide ? 'w-[86%] sm:w-[440px]' : 'w-[72%] sm:w-[290px]'),
      )}
      style={{ animationDelay: `${delay}ms`, backgroundColor: g.hex }}
    >
      <img
        src={photo.src}
        alt=""
        loading="lazy"
        className="absolute inset-0 -z-20 size-full object-cover opacity-80 mix-blend-luminosity grayscale transition-transform duration-700 ease-out group-hover:scale-[1.06]"
      />
      {/* The colour wash, then a dark foot for the type. */}
      <span aria-hidden className="absolute inset-0 -z-10 mix-blend-multiply" style={{ backgroundColor: g.hex, opacity: 0.55 }} />
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <span className="absolute top-4 left-4 rounded-full bg-white/20 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur-md">
        {g.tag}
      </span>
      <span className="font-display text-[23px] leading-[1.12] font-bold text-balance">{g.title}</span>
      <span className="mt-2 line-clamp-2 text-[13px] leading-snug text-white/85">{g.dek}</span>
      <span className="mt-3.5 flex items-center justify-between text-[12.5px] font-semibold">
        <span className="inline-flex items-center gap-1.5 text-white/80">
          <Clock size={13} aria-hidden /> {g.minutes} min read
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-white text-black transition-transform duration-300 group-hover:translate-x-1">
          <ArrowRight size={16} aria-hidden />
        </span>
      </span>
    </button>
  )
}

function Arrow({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full border border-border text-muted transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  )
}
