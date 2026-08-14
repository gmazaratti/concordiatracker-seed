import { Check, MessagesSquare } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useT } from '@/i18n/i18n'

/** Shared slide frame: a visual on top, then a tight headline + a line or two.
 * Exported so the interactive tour steps reuse the same framing. */
export function Slide({
  visual,
  headline,
  sub,
  extra,
}: {
  visual: React.ReactNode
  headline: React.ReactNode
  sub: string
  extra?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
      {visual}
      <h2 className="mt-6 font-display text-[22px] leading-tight font-semibold text-fg sm:mt-8 sm:text-[30px]">{headline}</h2>
      <p className="mt-2.5 max-w-md text-[13px] leading-relaxed text-muted sm:text-[14px]">{sub}</p>
      {extra}
    </div>
  )
}

export function WelcomeSlide() {
  const t = useT()
  return (
    <Slide
      visual={<Logo size="lg" />}
      headline={
        <>
          {t('onboarding.welcomeHead')} <span className="text-accent">{t('onboarding.welcomeHeadAccent')}</span>.
        </>
      }
      sub={t('onboarding.welcomeSub')}
    />
  )
}

export function DoneSlide() {
  const t = useT()
  return (
    <Slide
      visual={
        <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Check size={32} aria-hidden />
        </span>
      }
      headline={t('onboarding.doneHead')}
      sub={t('onboarding.doneSub')}
      extra={
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-left">
          <MessagesSquare size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-[13px] leading-relaxed text-muted">
            {t('onboarding.doneFeedbackA')}
            <span className="font-medium text-fg">{t('onboarding.doneFeedbackPath')}</span>
            {t('onboarding.doneFeedbackB')}
          </p>
        </div>
      }
    />
  )
}
