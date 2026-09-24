import { useRef } from 'react'
import { CalendarClock, RefreshCw, TrendingUp } from 'lucide-react'
import { CourseChip } from '@/components/CourseChip'
import { useT } from '@/i18n/i18n'
import { FlowPaths } from './FlowPaths'
import { useCardFloat } from './useCardFloat'

/**
 * The right-hand panel of the sign-in screen: three small status cards drawn
 * with the app's own pieces (CourseChip, the surface and border tokens, line
 * icons), so they read as the product rather than an illustration.
 *
 * Desktop only: on a phone the sign-in screen is the form alone, full width.
 *
 * The cards float and the flow lines drift, both from one rAF loop
 * (useCardFloat) writing transform and opacity only. No other colour is
 * introduced: the course chip uses the class palette the app already has, and
 * everything else is theme tokens, so the panel follows the viewer's light or
 * dark theme like the rest of the site.
 */
export function AuthShowcase() {
  const t = useT()
  const panelRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  useCardFloat(panelRef, headRef, listRef, flowRef)

  const cards = [
    <div key="due" className={card}>
      <div className="flex items-center justify-between gap-3">
        <CourseChip code="COMM 305" color="rose" />
        <span className="text-[12px] font-medium text-warning">{t('auth.scDue')}</span>
      </div>
      <p className="mt-2.5 text-[14px] font-medium text-fg">{t('auth.scAssign')}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-subtle">
        <CalendarClock size={13} aria-hidden />
        {t('auth.scAssignMeta')}
      </p>
    </div>,
    <div key="gpa" className={card}>
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <TrendingUp size={13} className="text-accent" aria-hidden />
        {t('auth.scGpa')}
      </p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-[28px] leading-none font-semibold text-fg tabular-nums">3.42</span>
        <span className="text-[12px] text-subtle">/ 4.30</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-[80%] rounded-full bg-accent" />
      </div>
      <p className="mt-2 text-[12px] text-subtle">{t('auth.scGpaHint')}</p>
    </div>,
    <div key="moodle" className={card}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <RefreshCw size={15} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-medium text-fg">{t('auth.scMoodle')}</span>
          <span className="block text-[12px] text-subtle">{t('auth.scMoodleMeta')}</span>
        </span>
      </div>
    </div>,
  ]

  return (
    <section
      ref={panelRef}
      aria-label={t('auth.showcaseTitle')}
      className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface p-10 xl:p-12"
    >
      <FlowPaths ref={flowRef} />
      <h2 ref={headRef} className="relative max-w-[18ch] font-display text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] text-fg xl:text-[34px]">
        {t('auth.showcaseTitle')}
      </h2>
      <div className="relative flex flex-1 items-center justify-center">
        <div ref={listRef} className="relative flex w-full max-w-[340px] flex-col gap-3">
          {/* The outer div carries the float (written by useCardFloat), the
              inner one the resting stagger, so the two never overwrite. */}
          <div className="will-change-transform">
            <div className="-translate-x-6">{cards[0]}</div>
          </div>
          <div className="will-change-transform">
            <div className="translate-x-8">{cards[1]}</div>
          </div>
          <div className="will-change-transform">
            <div className="-translate-x-2">{cards[2]}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

const card = 'rounded-2xl border border-border bg-canvas/90 p-4 shadow-[0_12px_32px_-18px_rgba(0,0,0,0.45)]'
