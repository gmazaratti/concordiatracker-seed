import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Laptop, Smartphone, Tablet } from 'lucide-react'
import { useNoIndex } from '@/app/hooks/useNoIndex'
import { PublicHeader } from '@/components/PublicHeader'
import { Logo } from '@/components/Logo'
import { StackedCards } from './StackedCards'
import { RecordlyFaq, RecordlyFooter } from './RecordlyFaqFooter'
import { RecordlyTiles } from './RecordlyTiles'

/** The header's height. The pinned card sits one pixel under it. */
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
 * THE HERO, which is the point: the product card is `position: sticky` 75px
 * from the top, just under the fixed header. Everything after it lives in ONE
 * solid layer with a higher z-index, starting right at the card's bottom edge,
 * so once the card pins, that layer slides up over it from below.
 */
export function RecordlyPage() {
  useNoIndex()
  usePageHead()

  return (
    <div id="top" data-theme="dark" className="min-h-[100dvh] overflow-x-clip bg-canvas font-sans text-white antialiased">
      <PublicHeader
        fixed
        pill
        height={HEADER_H}
        anchors={[
          { href: '#features', label: 'Features' },
          { href: '#faq', label: 'FAQ' },
        ]}
      />

      <main>
        <section className="mx-auto max-w-[1160px] px-4 pt-[112px] text-center md:pt-[126px]">
          <h1 className="text-[38px] leading-[1.05] font-bold tracking-[-0.05em] md:text-[62px]">
            Every deadline, one calm place
          </h1>
          <p className="mx-auto mt-5 max-w-[1130px] text-[17px] leading-[1.3] text-[#9b9b9b] md:mt-[26px] md:text-[19px]">
            ConcordiaTracker turns your course outlines into dated deadlines, weighted grades and a live GPA. Built for
            Concordia, with Moodle sync.
          </p>
          <Link
            to="/app"
            className="mt-6 inline-flex h-[52px] items-center gap-3 rounded-[6px] bg-accent px-6 text-[19px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover md:mt-[26px]"
          >
            Open the app free
            <ArrowRight className="size-[20px]" aria-hidden />
          </Link>
          {/* Where it runs: in the browser, on any of these. */}
          <div className="mt-[18px] flex items-center justify-center gap-5 text-[#9a9a9a]">
            <span className="sr-only">Works in the browser on a laptop, a tablet or a phone.</span>
            <Laptop className="size-[20px]" aria-hidden />
            <Tablet className="size-[20px]" aria-hidden />
            <Smartphone className="size-[20px]" aria-hidden />
          </div>
        </section>

        {/* The pinned card. */}
        <div className="sticky top-[75px] z-0 mx-auto mt-[60px] w-[calc(100%-32px)] max-w-[960px] md:mt-[80px]">
          <div className="aspect-[16/10] overflow-hidden rounded-[16px] shadow-[0_0_60px_var(--ct-accent-soft)] md:rounded-[24px]">
            <video
              src="/dev-landing-2/hero.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="size-full object-cover"
            />
          </div>
        </div>

        {/* Everything else: one solid layer that covers the pinned card. */}
        <div className="relative z-10 bg-canvas px-4 pt-[80px] pb-16 md:pt-[117px]">
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

          <RecordlyFaq />
          <RecordlyFooter />
        </div>
      </main>
    </div>
  )
}

/** This comp's tab title and description, put back when the page unmounts.
 *  noindex stays (useNoIndex). */
const TITLE = 'ConcordiaTracker: deadlines, grades and GPA for Concordia students'
const DESCRIPTION =
  'Upload your course outline and every deadline is dated for you. Track grades, see what you need to pass, sync Moodle, and follow campus clubs. Not affiliated with Concordia University.'

function usePageHead() {
  useEffect(() => {
    const prevTitle = document.title
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    const prevDesc = meta.content
    document.title = TITLE
    meta.content = DESCRIPTION
    // The app's own title hook may run after mount; hold ours for this page.
    const t = setTimeout(() => {
      document.title = TITLE
    }, 0)
    return () => {
      clearTimeout(t)
      document.title = prevTitle
      if (created) meta.remove()
      else meta.content = prevDesc
    }
  }, [])
}
