import type { CampusEvent } from '@/data/community'
import { cn } from '@/lib/cn'
import { CATEGORY_META } from './category'

type Variant = 'hero' | 'banner' | 'thumb'

const VARIANT: Record<
  Variant,
  { box: string; glyph: string; icon: number; handle: boolean; mono: string }
> = {
  hero: { box: 'h-52 w-full sm:h-60', glyph: '-right-4 -bottom-10 text-[200px]', icon: 24, handle: true, mono: 'text-[40px]' },
  banner: { box: 'h-32 w-full', glyph: '-right-3 -bottom-6 text-[120px]', icon: 15, handle: true, mono: 'text-[22px]' },
  thumb: { box: 'size-16 rounded-lg', glyph: '-right-1 -bottom-2 text-[52px]', icon: 20, handle: false, mono: 'text-[20px]' },
}

/** Event media — ONE consistent treatment, no second fallback variant:
 *  1. A real org-supplied image (`event.image`) → the image (object-cover). If it
 *     ever fails to load it hides itself, revealing the branded banner beneath, so
 *     it's never an empty/broken box.
 *  2. No image → a branded banner: a gradient derived from the HOST ORG's brand
 *     colour + the org's initials as a large faded monogram, so every org's events
 *     read with a consistent identity colour (JMSB, Gina Cody, …). */
export function EventMedia({
  event,
  variant,
  className,
}: {
  event: CampusEvent
  variant: Variant
  className?: string
}) {
  const v = VARIANT[variant]
  const color = event.org.color
  const Icon = CATEGORY_META[event.category].icon

  return (
    <div
      aria-hidden
      className={cn('relative shrink-0 overflow-hidden select-none', v.box, className)}
      style={{ backgroundColor: color }}
    >
      {/* Branded banner (always rendered — also the graceful fallback behind a real image). */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/35" />
      <span className={cn('absolute font-extrabold leading-none text-white/15', v.glyph)}>
        {event.org.glyph}
      </span>
      {v.handle ? (
        <>
          <span className="absolute top-3 left-3 grid size-7 place-items-center rounded-md bg-white/20 text-white backdrop-blur-sm">
            <Icon size={v.icon} />
          </span>
          <span className="absolute bottom-3 left-3.5 text-[13px] font-semibold tracking-wide text-white">
            {event.org.handle}
          </span>
        </>
      ) : (
        <span className={cn('absolute inset-0 grid place-items-center font-bold text-white', v.mono)}>
          {event.org.glyph}
        </span>
      )}

      {/* Real image, on top — hides itself on error so the branded banner shows. */}
      {event.image && (
        <img
          src={event.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </div>
  )
}
