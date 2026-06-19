import { Check, MessagesSquare } from 'lucide-react'
import { AppPreview } from '@/features/landing/AppPreview'
import { Logo } from '@/components/Logo'
import { useAppData } from '@/app/providers/app-data'

/** Shared slide frame: a visual on top, then a tight headline + a line or two. */
function Slide({ visual, headline, sub, extra }: { visual: React.ReactNode; headline: React.ReactNode; sub: string; extra?: React.ReactNode }) {
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

export function TodaySlide() {
  const { user } = useAppData()
  return (
    <Slide
      visual={<FramedPreview name={user.name} />}
      headline="It all lands on Today"
      sub="Your deadlines surface here automatically, across every course, with your GPA at a glance."
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

/** The real Today recreation in a browser-chrome frame, clipped with a fade. */
function FramedPreview({ name }: { name?: string }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-2/60 px-3 py-2">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ml-2 truncate text-[11px] text-subtle">concordiatracker.com/today</span>
      </div>
      <div className="relative h-[190px] overflow-hidden sm:h-[300px]">
        <div className="pointer-events-none origin-top scale-[0.78] sm:scale-[0.92]">
          <AppPreview name={name} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-surface" />
      </div>
    </div>
  )
}
