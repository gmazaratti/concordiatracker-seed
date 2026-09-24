import { useEffect } from 'react'
import { useNoIndex } from '@/app/hooks/useNoIndex'
import { RecordlyHeader } from './RecordlyHeader'
import { StackedCards } from './StackedCards'
import { RecordlyFaq, RecordlyFooter } from './RecordlyFaqFooter'
import { RecordlyTiles } from './RecordlyTiles'
import { AppleMark, CodeRabbitMark, LinuxMark, WindowsMark } from './glyphs'


/**
 * `/dev/landing/2`: a 1:1 layout and motion comp of recordly.dev, built from
 * the owner's screen recording and screenshots, so the structure can be
 * perfected before ConcordiaTracker's own content goes in. Hidden, noindex,
 * linked from nowhere.
 *
 * THE HERO, which is the point: the product card is `position: sticky` 75px
 * from the top (just under the fixed 76px header). Everything after it lives
 * in ONE solid-background layer with a higher z-index, starting right at the
 * card's bottom edge, so once the card pins, that layer slides up over it from
 * below. The card itself never scales, fades or moves once pinned. The layer is
 * solid for the whole rest of the page, so the pinned card stays hidden under
 * it to the end.
 */
export function RecordlyPage() {
  useNoIndex()
  useRecordlyHead()

  return (
    <div id="top" className="min-h-[100dvh] overflow-x-clip bg-[#0b0b0b] font-sans text-white antialiased">
      <RecordlyHeader />

      <main>
        <section className="mx-auto max-w-[1160px] px-4 pt-[112px] text-center md:pt-[126px]">
          <h1 className="text-[38px] leading-[1.05] font-bold tracking-[-0.05em] md:text-[62px]">
            Make beautiful screen recordings
          </h1>
          <p className="mx-auto mt-5 max-w-[1130px] text-[17px] leading-[1.3] text-[#9b9b9b] md:mt-[26px] md:text-[19px]">
            Recordly is your open-source tool for demos, walkthroughs, and product videos. Includes built-in auto-zooms,
            smooth cursor, and much more.
          </p>
          <a
            href="#top"
            className="mt-6 inline-flex h-[52px] items-center gap-3 rounded-[6px] bg-[#0b63f6] px-6 text-[19px] font-semibold text-white transition-colors hover:bg-[#1b6ff8] md:mt-[26px]"
          >
            <LinuxMark className="size-[20px]" />
            Download for Linux
          </a>
          <div className="mt-[18px] flex items-center justify-center gap-5 text-[#9a9a9a]">
            <WindowsMark className="size-[20px]" />
            <AppleMark className="size-[21px]" />
            <LinuxMark className="size-[21px]" />
          </div>
        </section>

        {/* The pinned card. */}
        <div className="sticky top-[75px] z-0 mx-auto mt-[60px] w-[calc(100%-32px)] max-w-[960px] md:mt-[80px]">
          <div className="aspect-[16/10] overflow-hidden rounded-[16px] shadow-[0_0_60px_rgba(70,130,255,0.18)] md:rounded-[24px]">
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
        <div className="relative z-10 bg-[#0b0b0b] px-4 pt-[80px] pb-16 md:pt-[117px]">
          <div className="text-center">
            <p className="text-[18px] text-[#8b8b8b] md:text-[20px]">Backed by the community</p>
            <p className="mt-2 flex items-center justify-center gap-2.5 text-[26px] font-bold tracking-[-0.03em] text-[#9b9b9b] md:text-[30px]">
              <CodeRabbitMark className="size-[30px]" />
              CodeRabbit
            </p>
          </div>

          <div className="mt-[90px] md:mt-[110px]">
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

/** Recordly's own tab title and description, verbatim from recordly.dev,
 *  put back to ours when the page unmounts. noindex stays (useNoIndex). */
const TITLE = 'Recordly - Open-source app for incredible screen recordings.'
const DESCRIPTION =
  'Recordly is an open‑source screen recorder for MacOS/Windows/Linux with auto-zoom, motion blur animated cursors, and minimal interface. Used to create product demos, guided walkthroughs and more. A free alternative to Screen Studio.'

function useRecordlyHead() {
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
