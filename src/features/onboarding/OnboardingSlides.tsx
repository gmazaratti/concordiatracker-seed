import { Check, MessagesSquare } from 'lucide-react'
import { Logo } from '@/components/Logo'

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
  return (
    <Slide
      visual={<Logo size="lg" />}
      headline={
        <>
          Stop guessing <span className="text-accent">what's due</span>.
        </>
      }
      sub="ConcordiaTracker pulls every deadline and grade into one calm place. Let's set you up in a minute."
    />
  )
}

export function DoneSlide() {
  return (
    <Slide
      visual={
        <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Check size={32} aria-hidden />
        </span>
      }
      headline="You're all set"
      sub="That's the spine — the rest you'll pick up as you go. Let's get you to Today."
      extra={
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-left">
          <MessagesSquare size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-[13px] leading-relaxed text-muted">
            Got an idea? Request a feature any time from your{' '}
            <span className="font-medium text-fg">profile menu → Feedback</span>. We read every one and reply.
          </p>
        </div>
      }
    />
  )
}
