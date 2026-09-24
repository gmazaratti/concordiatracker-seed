import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CARDS } from './cards-data'
import { CardExpand, type Origin } from './CardExpand'

/** How tall the fade at the covered card's cut edge is, in px. */
const FADE = 44

/**
 * Where a card may open into its expanded view: a desktop with a real pointer.
 * Not on a phone or a tablet: a card that grows to fill the screen fights the
 * page's own touch scrolling, so there the cards are simply cards.
 */
const DESKTOP = '(min-width: 768px) and (hover: hover) and (pointer: fine)'
function subscribe(cb: () => void) {
  const mq = window.matchMedia(DESKTOP)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const useDesktop = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => false)

/**
 * The three feature cards, stacking.
 *
 * Each card is `position: sticky` at the same top, in one shared parent, with
 * a rising z-index: the next card scrolls up OVER the pinned one. No scale, no
 * opacity on the card itself. The only script is the fade seen in the
 * reference, where the covered card's content dissolves at the line where the
 * next card starts: every frame, the covered card's CONTENT (not its panel) is
 * masked at that line, so the two panels read as one surface.
 *
 * On a desktop a card is also a button: it opens CardExpand, which grows out of
 * the card's exact box. The card hides while it is open, so there is only ever
 * one of it on screen, and focus comes back to it on close.
 */
export function StackedCards() {
  const list = useRef<HTMLDivElement>(null)
  const desktop = useDesktop()
  const [open, setOpen] = useState<{ index: number; origin: Origin } | null>(null)

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
     * different lengths, so a shorter card left the bottom of the taller one
     * peeking out underneath it. Every card gets the tallest card's natural
     * height, re-measured whenever any card's content changes size.
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

  const openCard = (index: number, el: HTMLElement) => {
    const media = el.querySelector<HTMLElement>('[data-card-media]')
    const text = el.querySelector<HTMLElement>('[data-card-text]')
    const video = el.querySelector('video')
    if (!media || !text) return
    setOpen({
      index,
      origin: {
        card: el.getBoundingClientRect(),
        media: media.getBoundingClientRect(),
        text: text.getBoundingClientRect(),
        time: video?.currentTime ?? 0,
      },
    })
  }

  const openIndex = open?.index
  const closed = useCallback(() => {
    setOpen(null)
    if (openIndex !== undefined) {
      list.current?.querySelectorAll<HTMLElement>('[data-stack-card]')[openIndex]?.focus({ preventScroll: true })
    }
  }, [openIndex])

  return (
    <div ref={list} className="mx-auto flex w-full max-w-[1080px] flex-col gap-14">
      {CARDS.map((c, i) => (
        <article
          key={c.title}
          data-stack-card
          style={{ zIndex: i + 1 }}
          {...(desktop && {
            role: 'button',
            tabIndex: 0,
            'aria-label': `${c.title}. Open for more`,
            onClick: (e: React.MouseEvent<HTMLElement>) => openCard(i, e.currentTarget),
            onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openCard(i, e.currentTarget)
              }
            },
          })}
          className={`sticky top-[88px] rounded-[18px] bg-[#161616] md:top-[128px] ${
            desktop
              ? 'cursor-pointer transition-shadow duration-200 outline-none hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] focus-visible:shadow-[inset_0_0_0_2px_var(--ct-accent)]'
              : ''
          }`}
        >
          <div
            data-stack-inner
            style={{ visibility: open?.index === i ? 'hidden' : undefined }}
            className={`flex flex-col gap-6 p-4 md:items-center md:gap-0 md:pt-[30px] md:pb-[40px] md:pl-[17px] ${
              c.mediaFirst ? 'md:flex-row md:pr-12' : 'md:flex-row-reverse md:pr-[16px]'
            }`}
          >
            <div
              data-card-media
              className="aspect-[580/330] w-full shrink-0 overflow-hidden rounded-[8px] bg-black md:w-1/2 lg:w-[580px]"
            >
              <video src={c.video} autoPlay muted loop playsInline preload="metadata" className="size-full object-cover" />
            </div>
            <div data-card-text className={`min-w-0 flex-1 pb-2 md:pb-0 ${c.mediaFirst ? 'md:pl-12' : 'md:pl-8 md:pr-12'}`}>
              <h3 className="text-[28px] leading-[1.06] font-bold tracking-[-0.045em] text-white md:text-[38px]">
                {c.title}
              </h3>
              <p className="mt-3 text-[16px] leading-[1.2] text-[#8b8b8b] md:mt-3.5">{c.body}</p>
            </div>
          </div>
        </article>
      ))}
      {open && <CardExpand card={CARDS[open.index]} origin={open.origin} onClosed={closed} />}
    </div>
  )
}
