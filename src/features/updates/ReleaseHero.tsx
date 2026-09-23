import {
  CalendarDays,
  Camera,
  Gauge,
  LifeBuoy,
  MessagesSquare,
  Newspaper,
  PlugZap,
  Sparkles,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { HeroIcon, Release } from '@/data/releases'

const ICON: Record<HeroIcon, LucideIcon> = {
  feed: Newspaper,
  events: CalendarDays,
  clubs: Users,
  posts: Camera,
  stories: Timer,
  scan: Gauge,
  dm: MessagesSquare,
  support: LifeBuoy,
  integrations: PlugZap,
}

/**
 * A major release, presented as a launch rather than a changelog entry.
 *
 * Built only from tokens and CSS (no images, no animation library): an accent
 * glow behind a version number set large enough to be the headline, one
 * sentence of what it means, and a grid of what is new with a glyph each. The
 * counts under it are computed from the release's own change list, so the
 * panel can never claim more than the list below it contains.
 */
export function ReleaseHero({ release }: { release: Release }) {
  const hero = release.hero!
  const count = (k: 'new' | 'improved' | 'fixed') => release.changes.filter((c) => c.kind === k).length
  const version = release.version.replace(/\.0$/, '')

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-accent/40 bg-surface">
      {/* Light, not decoration for its own sake: two soft accent pools make
          the number read as lit from behind. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-accent/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -bottom-28 size-80 rounded-full bg-accent/15 blur-3xl" />
      <div aria-hidden className="ct-grid-plain pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative px-5 pt-6 pb-5 sm:px-7 sm:pt-8">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] text-accent-contrast uppercase">
          <Sparkles size={12} aria-hidden />
          Version two is here
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
          <span className="bg-gradient-to-br from-fg to-accent bg-clip-text font-display text-[88px] leading-[0.85] font-extrabold tracking-tighter text-transparent tabular-nums sm:text-[120px]">
            {version}
          </span>
          <span className="pb-2 font-display text-[22px] leading-tight font-semibold tracking-tight text-fg sm:text-[28px]">
            {hero.headline}
          </span>
        </div>
        <p className="mt-4 max-w-prose text-[14.5px] leading-relaxed text-muted">{hero.tagline}</p>

        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {hero.highlights.map((h) => {
            const Icon = h.icon ? ICON[h.icon] : Sparkles
            return (
              <li key={h.title} className="flex gap-3 rounded-2xl border border-border/70 bg-canvas/60 p-3.5 backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-fg">{h.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{h.text}</span>
                </span>
              </li>
            )
          })}
        </ul>

        <p className="mt-5 text-[12px] text-subtle tabular-nums">
          {count('new')} new · {count('improved')} improved · {count('fixed')} fixed — the full list is below.
        </p>
      </div>
    </div>
  )
}
