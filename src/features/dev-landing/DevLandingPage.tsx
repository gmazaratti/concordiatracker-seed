import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ParseShowcase } from '@/features/landing/ParseShowcase'
import { DevHeader } from './DevHeader'
import { HeroStage } from './HeroStage'
import { FeaturePanel } from './FeaturePanel'
import { DemoVideo } from './DemoVideo'
import { DEMO_SLOTS, type DemoSlotId } from './demo-slots'
import { MiniParse } from './MiniParse'
import { MiniGrade } from './MiniGrade'
import { MiniCalendar } from './MiniCalendar'
import { MiniCommunity } from './MiniCommunity'
import { Reveal } from './Reveal'
import { useNoIndex } from '@/app/hooks/useNoIndex'
import { useDevCopy } from './copy'

/** The live stand-in each video slot shows until its clip is supplied. */
const LIVE: Record<DemoSlotId, React.ReactNode> = {
  syllabus: <MiniParse />,
  grades: <MiniGrade />,
  calendar: <MiniCalendar />,
  community: <MiniCommunity />,
}

function Slot({ id }: { id: DemoSlotId }) {
  const s = DEMO_SLOTS[id]
  return (
    <DemoVideo
      src={s.src}
      poster={s.poster}
      aspect={s.aspect}
      label={s.label}
      fallback={LIVE[id]}
      className="min-h-[320px] sm:min-h-[360px]"
    />
  )
}

/**
 * HIDDEN DRAFT of a new landing, at /dev/landing. Not linked from anywhere,
 * noindex while mounted, disallowed in robots.txt. The live landing is
 * untouched.
 *
 * Shape (after recordly.dev): a centred hero, then the real Today screen in a
 * card that pins under the header while the rest of the page slides up over it,
 * then feature panels in ordinary flow that fade up as they arrive.
 */
export function DevLandingPage() {
  const copy = useDevCopy()
  useNoIndex()
  useEffect(() => {
    const prev = document.title
    document.title = 'ConcordiaTracker (draft)'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="min-h-svh bg-canvas text-fg">
      <DevHeader />
      <main>
        <HeroStage>
          <Reveal as="p" className="mx-auto max-w-2xl px-6 pt-16 text-center text-[13.5px] leading-relaxed text-subtle sm:pt-20">
            {copy.backedBy}
          </Reveal>

          <section id="features" className="mx-auto flex w-full max-w-[1080px] scroll-mt-24 flex-col gap-5 px-4 py-14 sm:gap-6 sm:px-6 sm:py-20">
            <FeaturePanel index={1} eyebrow={copy.f1Eyebrow} title={copy.f1Title as [string, string]} body={copy.f1Body} media={<Slot id="syllabus" />} />
            <FeaturePanel index={2} flip eyebrow={copy.f2Eyebrow} title={copy.f2Title as [string, string]} body={copy.f2Body} media={<Slot id="grades" />} />
            <FeaturePanel index={3} eyebrow={copy.f3Eyebrow} title={copy.f3Title as [string, string]} body={copy.f3Body} media={<Slot id="calendar" />} />
            <FeaturePanel index={4} flip eyebrow={copy.f4Eyebrow} title={copy.f4Title as [string, string]} body={copy.f4Body} media={<Slot id="community" />} />
          </section>

          {/* The full parse beat, reused as-is from the live landing. */}
          <ParseShowcase />

          <section className="border-t border-border/60 px-5 py-24 sm:py-32">
            <div className="mx-auto grid w-full max-w-5xl items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <Reveal as="h2" className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.03] font-bold tracking-[-0.03em] text-fg">
                {copy.ctaTitleA}
                <br />
                <span className="text-muted">{copy.ctaTitleB}</span>
              </Reveal>
              <Reveal delay={90} className="lg:pb-2">
                <p className="max-w-sm text-[15px] leading-relaxed text-muted">{copy.ctaBody}</p>
                <Link to="/dev/login" className="mt-6 inline-block">
                  <Button size="lg" className="group">
                    {copy.heroCta}
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </Reveal>
            </div>
          </section>

          <footer className="border-t border-border/60">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-[12px] text-subtle sm:flex-row sm:justify-between">
              <p>{copy.notAffiliated}</p>
              <nav className="flex gap-4">
                <Link to="/privacy" className="hover:text-fg">Privacy</Link>
                <Link to="/terms" className="hover:text-fg">Terms</Link>
                <a href="/docs/introduction" className="hover:text-fg">{copy.navDocs}</a>
              </nav>
            </div>
          </footer>
        </HeroStage>
      </main>
    </div>
  )
}
