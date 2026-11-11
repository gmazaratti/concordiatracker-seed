import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import type { Guide } from '@/data/guides'
import type { Resource } from '@/data/resources'
import { PHOTOS } from '@/data/resource-photos'
import { cn } from '@/lib/cn'
import { GuideBody } from './GuideBody'
import { tocOf, type TocEntry } from './guide-toc'

/** How far below the sticky bar a heading sits when it counts as "current". */
const OFFSET = 96

/**
 * One guide as a full page: a wide article column (title, photo and text all
 * on the same edges) with an "On this page" list beside it, like a docs site.
 * It is an overlay rather than a route so the Resources page keeps its place
 * behind it, but the guide is in the URL, so it links and Back closes it.
 */
export function GuideReader({
  g,
  faculty,
  onClose,
  onOpen,
  next,
  onRead,
}: {
  g: Guide
  faculty: Resource['faculty'] | null
  onClose: () => void
  onOpen: (r: Resource) => void
  next?: Guide
  onRead: (slug: string) => void
}) {
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const photo = PHOTOS[g.photo]
  const toc = useMemo(() => tocOf(g.body), [g])
  const [current, setCurrent] = useState<string | null>(null)

  // The entry whose heading most recently passed under the bar is the current one.
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const update = () => {
      const top = box.getBoundingClientRect().top + OFFSET + 8
      let id: string | null = null
      for (const e of toc) {
        const el = box.querySelector<HTMLElement>(`#${e.id}`)
        if (el && el.getBoundingClientRect().top <= top) id = e.id
      }
      setCurrent(id)
    }
    const first = window.setTimeout(update, 0)
    box.addEventListener('scroll', update, { passive: true })
    return () => {
      window.clearTimeout(first)
      box.removeEventListener('scroll', update)
    }
  }, [ref, toc])

  const jump = (id: string) => {
    const box = ref.current
    const el = box?.querySelector<HTMLElement>(`#${id}`)
    if (!box || !el) return
    const y = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - OFFSET
    box.scrollTo({ top: y, behavior: 'smooth' })
  }

  return createPortal(
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={g.title}
      tabIndex={-1}
      className="ct-guide-open fixed inset-0 z-[90] overflow-y-auto bg-canvas outline-none"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-canvas/85 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft size={16} aria-hidden /> Resources
        </button>
        <span className="hidden min-w-0 truncate text-[13px] font-medium text-subtle sm:block">{g.title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          className="grid size-9 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <X size={17} aria-hidden />
        </button>
      </div>

      {/* Keyed so moving to the next guide replays the entrance from the top. */}
      <div
        key={g.slug}
        className="ct-guide-body mx-auto grid max-w-[1160px] gap-x-16 px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_230px]"
      >
        <article className="min-w-0">
          <header>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-subtle">
              <span className="font-semibold tracking-[0.12em] uppercase" style={{ color: g.hex }}>
                {g.tag}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} aria-hidden /> {g.minutes} min read
              </span>
            </p>
            <h1 className="mt-3 font-display text-[34px] leading-[1.05] font-bold tracking-tight text-balance text-fg sm:text-[52px]">
              {g.title}
            </h1>
            <p className="mt-4 text-[18px] leading-relaxed text-muted sm:text-[20px]">{g.dek}</p>
            <figure className="mt-8">
              <img
                src={photo.src}
                alt={photo.alt}
                className="aspect-[16/9] w-full rounded-2xl object-cover sm:aspect-[2/1] sm:rounded-3xl"
              />
              <figcaption className="mt-2 text-[11.5px] text-subtle">
                {photo.alt}. Photo:{' '}
                <a href={photo.page} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-fg">
                  {photo.by}
                </a>
                , {photo.licence}
              </figcaption>
            </figure>
          </header>

          <div className="pt-8 sm:pt-10">
            <GuideBody body={g.body} hex={g.hex} faculty={faculty} onOpen={onOpen} />

            <footer className="mt-12 border-t border-border pt-6 text-[13px] leading-relaxed text-subtle">
              <p>
                Written by ConcordiaTracker and checked against the official pages below in November 2026. It is advice,
                not university policy; where they differ, the official page is right.
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                {g.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 font-medium text-muted underline underline-offset-2 hover:text-fg"
                    >
                      {s.label} <ArrowUpRight size={12} aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </footer>

            {next && (
              <button
                type="button"
                onClick={() => {
                  ref.current?.scrollTo({ top: 0 })
                  onRead(next.slug)
                }}
                className="group mt-10 flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-border bg-surface p-3 text-left transition-colors duration-150 hover:border-border-strong"
              >
                <img src={PHOTOS[next.photo].src} alt="" className="size-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-36" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold tracking-[0.12em] text-subtle uppercase">Read next</span>
                  <span className="mt-0.5 block font-display text-[19px] leading-snug font-semibold text-fg">{next.title}</span>
                </span>
                <ArrowRight
                  size={18}
                  className="mr-2 shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-1 group-hover:text-fg"
                  aria-hidden
                />
              </button>
            )}
          </div>
        </article>

        {toc.length > 1 && <Outline toc={toc} current={current} onJump={jump} hex={g.hex} />}
      </div>
    </div>,
    document.body,
  )
}

/**
 * "On this page": a short rule beside each section, longer and coloured for
 * the one you are reading. Desktop only; a phone has no room beside the text.
 */
function Outline({
  toc,
  current,
  onJump,
  hex,
}: {
  toc: TocEntry[]
  current: string | null
  onJump: (id: string) => void
  hex: string
}) {
  return (
    <nav aria-label="On this page" className="hidden lg:block">
      <div className="sticky top-24">
        <p className="text-[12px] font-semibold tracking-[0.12em] text-subtle uppercase">On this page</p>
        <ul className="mt-3 space-y-0.5">
          {toc.map((e) => {
            const on = e.id === current
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onJump(e.id)}
                  aria-current={on ? 'location' : undefined}
                  className={cn(
                    'group flex w-full items-center gap-3 py-1.5 text-left text-[13.5px] leading-snug transition-colors duration-150',
                    on ? 'font-semibold text-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'h-[2px] shrink-0 rounded-full transition-[width,background-color] duration-200',
                      on ? 'w-7' : e.level === 1 ? 'w-4 bg-border-strong group-hover:w-6' : 'w-2.5 bg-border-strong group-hover:w-4',
                    )}
                    style={on ? { backgroundColor: hex } : undefined}
                  />
                  <span className="min-w-0 flex-1">{e.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
