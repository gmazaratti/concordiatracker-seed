import { useEffect, useRef } from 'react'

type Card = {
  title: string
  body: string
  media: { kind: 'video' | 'image'; src: string }
  /** Recordly alternates: media left, then text left, then media left. */
  mediaFirst: boolean
}

const CARDS: Card[] = [
  {
    title: 'Auto-zoom, silky cursor & beautiful backgrounds',
    body: 'Recordly adds beautiful cursor animations and auto-zooming plus a background to your recordings so you can spend less time editing and more time shipping.',
    media: { kind: 'video', src: '/dev-landing-2/card-1.mp4' },
    mediaFirst: true,
  },
  {
    title: 'Dynamic webcam bubble overlay',
    body: 'Recordly uses smart webcam bubbles that expand and shrink to make sure you get the spotlight when you need to.',
    media: { kind: 'video', src: '/dev-landing-2/card-2.mp4' },
    mediaFirst: false,
  },
  {
    title: 'Intuitive timeline editing interface',
    body: 'Use drag-and-drop pieces to control video speed, zooms, annotations, audio tracks and video length, and save your projects as .recordly files so you can save your progress or edit other projects.',
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
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
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
