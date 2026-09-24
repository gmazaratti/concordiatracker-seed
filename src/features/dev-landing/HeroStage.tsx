import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AppPreview } from '@/features/landing/AppPreview'
import { Reveal } from './Reveal'
import { PIN_TOP } from './layout'
import { useDevCopy } from './copy'

/**
 * The hero, the pinned product card, and whatever slides up over it.
 *
 * THE WHOLE EFFECT IS `position: sticky` PLUS A HIGHER Z-INDEX. The card pins
 * under the header at a constant size; `children` (the rest of the page) has a
 * solid canvas background and z-10, so ordinary scrolling carries it up over the
 * card and covers it from the bottom. No scroll listener, no scale, no opacity
 * scrubbing, which is why it is as smooth as the browser's own scrolling and
 * costs nothing under reduced motion.
 *
 * The card and `children` share one parent on purpose: a sticky element only
 * pins within its parent, so this bounds the pin to the part of the page that
 * covers it instead of leaving it stuck behind the footer.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const copy = useDevCopy()
  return (
    <>
      <section className="relative isolate px-5 pt-12 pb-10 text-center sm:pt-16 sm:pb-12">
        <div className="ct-grid-bg pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden />
        <div className="mx-auto max-w-3xl">
          <Reveal immediate as="p" className="text-[12px] font-medium tracking-[0.22em] text-subtle uppercase">
            {copy.heroEyebrow}
          </Reveal>
          <Reveal immediate delay={70} as="h1" className="mt-5 font-display text-[clamp(2.4rem,6.2vw,4.6rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance text-fg">
            {copy.heroTitleA} <span className="text-accent">{copy.heroTitleB}</span>
          </Reveal>
          <Reveal immediate delay={140} as="p" className="mx-auto mt-6 max-w-xl text-[clamp(1rem,1.5vw,1.15rem)] leading-relaxed text-pretty text-muted">
            {copy.heroBody}
          </Reveal>
          <Reveal immediate delay={210} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/dev/login" className="w-full sm:w-auto">
              <Button size="lg" className="group w-full sm:w-auto">
                {copy.heroCta}
                <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <a href="#how" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                {copy.heroSecondary}
              </Button>
            </a>
          </Reveal>
          <Reveal immediate delay={280}>
            <PlatformRow />
          </Reveal>
        </div>
      </section>

      <div className="relative">
        <div className="sticky z-0 px-4 sm:px-6" style={{ top: PIN_TOP }} data-pinned-card>
          <Reveal immediate delay={320} className="mx-auto w-full max-w-[990px]">
            <ProductCard />
          </Reveal>
        </div>

        {/* The sheet that slides over the card. Solid, above it, with a soft
            shadow on its leading edge so it reads as a surface arriving rather
            than the card being erased. */}
        <div
          data-cover
          className="relative z-10 mt-16 rounded-t-[28px] border-t border-border/70 bg-canvas shadow-[0_-40px_80px_-30px_rgba(0,0,0,0.55)] sm:mt-24"
        >
          {children}
        </div>
      </div>
    </>
  )
}

function PlatformRow() {
  const copy = useDevCopy()
  const items = [
    { icon: Monitor, label: copy.platformWeb },
    { icon: Smartphone, label: copy.platformIphone },
    { icon: Smartphone, label: copy.platformAndroid },
  ]
  return (
    <div className="mt-7 flex flex-col items-center gap-1.5 text-[12.5px] text-subtle">
      <div className="flex items-center gap-3">
        <span>{copy.platformsLabel}</span>
        <span className="h-3 w-px bg-border" aria-hidden />
        <ul className="flex items-center gap-3.5">
          {items.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1.5 text-muted">
              <Icon size={13} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <span>{copy.platformNote}</span>
    </div>
  )
}

/** The live Today screen in a browser frame. Constant size by design. */
function ProductCard() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-border-strong/70 bg-surface shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_90px_-24px_var(--ct-accent-soft),0_50px_120px_-50px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="mx-auto rounded-md border border-border bg-canvas/60 px-3 py-1 text-[11px] text-subtle">
          concordiatracker.com/today
        </span>
        <span className="w-[42px]" aria-hidden />
      </div>
      <div className="h-[420px] overflow-hidden sm:h-[540px] lg:h-[min(600px,calc(100svh-150px))]" aria-hidden>
        <div className="pointer-events-none h-full select-none">
          <AppPreview />
        </div>
      </div>
    </div>
  )
}
