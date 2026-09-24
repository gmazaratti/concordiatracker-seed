import { CalendarClock, RefreshCw, TrendingUp } from 'lucide-react'
import { CourseChip } from '@/components/CourseChip'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

/**
 * The right-hand panel of the sign-in screen: three small status cards drawn
 * with the app's own pieces (CourseChip, the surface and border tokens, line
 * icons), so they read as the product rather than an illustration.
 *
 * `strip` is the phone form: the same headline and the same cards, laid out
 * as a row that scrolls sideways above the form instead of a tall panel.
 *
 * One soft sage glow sits behind the cards, from the accent-soft token. No
 * other colour is introduced: the course chip uses the class palette the app
 * already has, and everything else is theme tokens, so the panel follows the
 * viewer's light or dark theme like the rest of the site.
 */
export function AuthShowcase({ strip = false }: { strip?: boolean }) {
  const t = useT()

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

  if (strip) {
    return (
      <section aria-label={t('auth.showcaseTitle')} className="relative overflow-hidden border-b border-border bg-surface">
        <Glow className="top-1/2 left-1/2 h-40 w-[80%]" />
        <p className="relative px-5 pt-6 font-display text-[18px] leading-tight font-semibold text-fg">
          {t('auth.showcaseTitle')}
        </p>
        <div className="relative mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cards.map((c) => (
            <div key={c.key} className="w-[250px] shrink-0 snap-start">
              {c}
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label={t('auth.showcaseTitle')}
      className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface p-10 xl:p-12"
    >
      <h2 className="relative max-w-[18ch] font-display text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] text-fg xl:text-[34px]">
        {t('auth.showcaseTitle')}
      </h2>
      <div className="relative flex flex-1 items-center justify-center">
        <Glow className="top-1/2 left-1/2 h-72 w-80" />
        <div className="relative flex w-full max-w-[340px] flex-col gap-3">
          <div className="-translate-x-6">{cards[0]}</div>
          <div className="translate-x-8">{cards[1]}</div>
          <div className="-translate-x-2">{cards[2]}</div>
        </div>
      </div>
    </section>
  )
}

const card = 'rounded-2xl border border-border bg-canvas/90 p-4 shadow-[0_12px_32px_-18px_rgba(0,0,0,0.45)]'

/** The one sage glow: the accent-soft token, blurred, behind the cards. */
function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft blur-3xl',
        className,
      )}
    />
  )
}
