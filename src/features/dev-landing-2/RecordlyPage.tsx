import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { PublicHeader } from '@/components/PublicHeader'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { useT } from '@/i18n/i18n'
import { AppPreview } from '@/features/landing/AppPreview'
import { PricingSection } from '@/features/landing/PricingSection'
import { StackedCards } from './StackedCards'
import { RecordlyFaq, RecordlyFooter } from './RecordlyFaqFooter'
import { RecordlyTiles } from './RecordlyTiles'

/** The fixed header's height; the hero starts below it. */
const HEADER_H = 76

/**
 * `/dev/landing/2`: the Recordly layout and motion comp, now carrying
 * ConcordiaTracker's own navbar, colours and copy. Hidden, noindex, linked
 * from nowhere; the live landing page is untouched.
 *
 * LOCKED TO THE DARK BRAND. The root carries `data-theme="dark"`, and every
 * token rule in index.css is written against `[data-theme]` rather than only
 * `:root`, so this subtree resolves to the real brand palette (canvas #0f0f16,
 * sage accent) whatever theme the viewer picked in the app. Text colours and
 * type are still the comp's own, on purpose, until those are decided.
 *
 * THE HERO is the main landing page's side-by-side composition: the copy and
 * both buttons on the left, the live Today embed on the right, bleeding off
 * the right edge. On a phone the copy stacks above the embed, which is capped
 * at 420px with a bottom fade so it reads as a window into the product.
 */
export function RecordlyPage() {
  // THE PRODUCTION HOMEPAGE since 2026-09-24 (it was the /dev/landing/2 comp).
  // Indexable, canonical https://concordiatracker.com/. The /r route renders
  // this same page and adds its own noindex on top (see RefLanding).
  usePageMeta({ title: TITLE, description: DESCRIPTION, path: '/' })
  const t = useT()

  return (
    <div id="top" data-theme="dark" className="min-h-[100dvh] overflow-x-clip bg-canvas font-sans text-white antialiased">
      <PublicHeader
        fixed
        lang="text"
        docs={false}
        cta="account"
        height={HEADER_H}
        anchors={[
          { href: '#features', label: 'Features' },
          { href: '#faq', label: 'FAQ' },
        ]}
      />

      <main>
        {/* ---- Hero: copy left, the real Today screen right ---- */}
        <section className="relative overflow-hidden px-5 pt-[112px] pb-10 sm:pt-[140px] lg:pb-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:gap-10">
            <div className="w-full lg:w-[46%] lg:flex-none">
              {/* Optically aligned: the "S" of the headline starts 0.03125em into
                  its box (Hanken Grotesk's side bearing) while the eyebrow's "F"
                  starts 0.94px into its own, so the eyebrow is nudged by the
                  difference, computed from the headline's own clamp so it holds
                  at every width. Measured with canvas text metrics. */}
              <p className="pl-[calc(0.03125*clamp(2.5rem,5vw,4.5rem)_-_0.94px)] text-[12px] font-medium tracking-[0.22em] text-[#9b9b9b] uppercase">
                {t('landing.eyebrow')}
              </p>
              {/* The main landing page's hero headline, class for class. */}
              <h1 className="mt-5 font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.02] font-medium tracking-[-0.022em] text-fg">
                {t('landing.heroTitle')} <span className="text-accent">{t('landing.heroTitleAccent')}.</span>
              </h1>
              <p className="mt-6 max-w-md text-[17px] leading-[1.45] text-[#9b9b9b] md:text-[18px]">{t('landing.heroBody')}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to="/app" className="w-full sm:w-auto">
                  <Button size="lg" className="group w-full sm:w-auto">
                    {t('landing.ctaPrimary')}
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                  </Button>
                </Link>
                <a href="#features" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {t('landing.ctaSecondary')}
                  </Button>
                </a>
              </div>
              <p className="mt-4 text-[12.5px] text-[#8b8b8b]">{t('landing.freeToStart')}</p>
            </div>

            {/* The real Today screen, live: AppPreview is the actual Today layout
                built from the demo data and the app's own components, with the
                real sidebar and the ConcordiaTracker brand account. No browser
                chrome, which read as a mock-up. On a desktop it overruns the
                right edge, capped so it never stretches on a wide screen; on a
                phone it is the real mobile Today (top bar, greeting, due list)
                in a 420px window with a bottom fade. */}
            <div className="relative w-full lg:w-[60vw] lg:max-w-[820px] lg:flex-none">
              <div className="h-[420px] overflow-hidden rounded-2xl border border-border bg-canvas shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] lg:h-[560px]">
                <div className="pointer-events-none h-full select-none" aria-hidden>
                  <AppPreview account="brand" />
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-px bottom-px h-24 rounded-b-2xl bg-gradient-to-b from-transparent to-canvas lg:hidden" aria-hidden />
            </div>
          </div>
          {/* Desktop: soften the embed's bleeding right edge into the canvas. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-40 bg-gradient-to-r from-transparent to-canvas lg:block" aria-hidden />
        </section>

        {/* Everything after the hero, on one solid layer. The top padding is
            small on purpose: "Built by fellow students" is the next thing on
            the page and should show in the first screen on a laptop, not
            wait under a band of empty space. */}
        <div className="relative z-10 bg-canvas px-4 pt-6 pb-16 md:pt-4">
          <div className="text-center">
            <p className="text-[18px] text-[#8b8b8b] md:text-[20px]">Built by fellow students</p>
            <p className="mt-2 flex items-center justify-center gap-2.5 text-[26px] font-bold tracking-[-0.03em] text-[#9b9b9b] md:text-[30px]">
              <Logo showText={false} />
              ConcordiaTracker
            </p>
          </div>

          <div id="features" className="mt-[90px] scroll-mt-[96px] md:mt-[110px]">
            <StackedCards />
          </div>

          <RecordlyTiles />

          {/* Pricing, straight above the FAQ, as on the main page. */}
          <div className="-mx-4 mt-32">
            <PricingSection />
          </div>

          <RecordlyFaq />

          {/* The main page's closing section, in the same place: after the FAQ. */}
          <section className="-mx-4 mt-16 border-t border-border/60 px-5 pt-20 pb-10 sm:pt-36 sm:pb-16 md:mt-32">
            <div className="mx-auto grid w-full max-w-[1080px] items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <h2 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.04] font-medium text-white">
                {t('landing.ctaHeadingA')}
                <br />
                {t('landing.ctaHeadingB')}
              </h2>
              <div className="lg:pb-2">
                <p className="max-w-sm text-[15px] leading-relaxed text-[#9b9b9b]">{t('landing.ctaBody')}</p>
                <Link to="/app" className="mt-6 inline-block">
                  <Button size="lg" className="group">
                    {t('landing.ctaPrimary')}
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          <RecordlyFooter />
        </div>
      </main>
    </div>
  )
}

/** The homepage's tab title and description. index.html carries the same two
 *  strings, so a crawler that does not run JavaScript sees what a visitor sees;
 *  change them together. */
// The one em dash allowed on this page: the tab title, as it was before the purge.
const TITLE = 'ConcordiaTracker — GPA, syllabus & assignment tracker for Concordia students'
const DESCRIPTION =
  'Upload your course outline and every deadline is dated for you. Track grades, see what you need to pass, sync Moodle, and follow campus clubs. Not affiliated with Concordia University.'
