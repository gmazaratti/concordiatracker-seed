import { useEffect, useRef } from 'react'

type Card = {
  title: string
  body: string
  media: { kind: 'video' | 'image'; src: string }
  /** The layout alternates: media left, then text left, then media left. */
  mediaFirst: boolean
}

const CARDS: Card[] = [
  {
    title: 'Upload your outline, get every deadline dated',
    body: 'Drop in your course outline PDF and ConcordiaTracker pulls out every assessment, its weight and its due date, so you check a list instead of retyping a syllabus.',
    // The real syllabus-parse flow, recorded on the live app (COMM 305).
    media: { kind: 'video', src: '/dev-landing-2/syllabus-parse.mp4' },
    mediaFirst: true,
  },
  {
    title: 'Know the grade you need to pass',
    body: 'Enter marks as they come back and see your standing, the average you still need, and where your GPA lands.',
    media: { kind: 'video', src: '/dev-landing-2/card-2.mp4' },
    mediaFirst: false,
  },
  {
    title: 'Moodle deadlines, pulled in for you',
    body: 'Paste your Moodle calendar link once and dated Moodle events land in your calendar, checked again every night. When a professor moves a date, you see the old and new date side by side.',
    media: { kind: 'image', src: '/dev-landing-2/card-3.avif' },
    mediaFirst: true,
  },
]

/** How tall the fade at the covered card's cut edge is, in px. */
const FADE = 44

/**
 * The three feature cards, stacking.
 *
 * Each card is `position: sticky` at the same top, in one shared parent, with
 * a rising z-index: the next card scrolls up OVER the pinned one. No scale, no
 * opacity on the card itself. The only script is the fade seen in the
 * reference, where the covered card's content dissolves at the line where the
 * next card starts: every frame, the covered card's CONTENT (not its panel) is
 * masked at that line, so the two panels read as one surface. When the parent
 * ends, the stuck cards leave together, as Recordly's do.
 */
export function StackedCards() {
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = list.current
    if (!root) return
    let raf = 0
    const update = () => {
      raf = 0
      const cards = [...root.querySelectorAll<HTMLElement>('[data-stack-card]')]
      cards.forEach((card, i) => {
        const inner = card.querySelector<HTMLElement>('[data-stack-inner]')
        const next = cards[i + 1]
        if (!inner) return
        const a = card.getBoundingClientRect()
        const b = next?.getBoundingClientRect()
        if (b && b.top < a.bottom) {
          const cut = Math.max(0, b.top - a.top)
          const m = `linear-gradient(to bottom, #000 ${Math.max(0, cut - FADE)}px, transparent ${cut}px)`
          inner.style.maskImage = m
          inner.style.webkitMaskImage = m
        } else if (inner.style.maskImage) {
          inner.style.maskImage = ''
          inner.style.webkitMaskImage = ''
        }
      })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    /*
     * EQUAL HEIGHTS, at every width. The cards only stack cleanly if each one is
     * exactly as tall as the one it covers: on a phone the text wraps to
     * different lengths (measured 398 / 378 / 417px at 390), so a shorter card
     * left the bottom of the taller one peeking out underneath it, and the stack
     * left the screen with ragged edges. Every card gets the tallest card's
     * natural height, re-measured whenever any card's content changes size
     * (rotation, font load, a video's metadata arriving).
     */
    const equalize = () => {
      const cards = [...root.querySelectorAll<HTMLElement>('[data-stack-card]')]
      const tallest = Math.max(
        ...cards.map((c) => c.querySelector<HTMLElement>('[data-stack-inner]')?.offsetHeight ?? 0),
      )
      for (const c of cards) c.style.minHeight = `${tallest}px`
      onScroll()
    }
    const ro = new ResizeObserver(equalize)
    root.querySelectorAll('[data-stack-inner]').forEach((el) => ro.observe(el))

    // Not only through the observer: measured once now, and again on resize and
    // once everything (fonts, video metadata) has loaded.
    equalize()
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', equalize)
    window.addEventListener('load', equalize)
    return () => {
      ro.disconnect()
      window.removeEventListener('load', equalize)
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', equalize)
    }
  }, [])

  return (
    <div ref={list} className="mx-auto flex w-full max-w-[1080px] flex-col gap-14">
      {CARDS.map((c, i) => (
        <article
          key={c.title}
          data-stack-card
          style={{ zIndex: i + 1 }}
          className="sticky top-[88px] rounded-[18px] bg-[#161616] md:top-[128px]"
        >
          <div
            data-stack-inner
            className={`flex flex-col gap-6 p-4 md:items-center md:gap-0 md:pt-[30px] md:pb-[40px] md:pl-[17px] ${
              c.mediaFirst ? 'md:flex-row md:pr-12' : 'md:flex-row-reverse md:pr-[16px]'
            }`}
          >
            <div className="aspect-[580/330] w-full shrink-0 overflow-hidden rounded-[8px] bg-black md:w-1/2 lg:w-[580px]">
              {c.media.kind === 'video' ? (
                <video
                  src={c.media.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="size-full object-cover"
                />
              ) : (
                <img src={c.media.src} alt="" className="size-full object-cover" loading="lazy" />
              )}
            </div>
            <div className={`min-w-0 flex-1 pb-2 md:pb-0 ${c.mediaFirst ? 'md:pl-12' : 'md:pl-8 md:pr-12'}`}>
              <h3 className="text-[28px] leading-[1.06] font-bold tracking-[-0.045em] text-white md:text-[38px]">
                {c.title}
              </h3>
              <p className="mt-3 text-[16px] leading-[1.2] text-[#8b8b8b] md:mt-3.5">{c.body}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
