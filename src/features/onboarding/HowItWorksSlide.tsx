import { CalendarDays, Check, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** ONE calm overview replacing the three confusing "interactive" slides (Today /
 * Calendar / Editing) — which silently required an action and left people stuck.
 * This just SHOWS the three core moves with mini mockups; the post-onboarding
 * tour then walks them through hands-on on the real UI. */
export function HowItWorksSlide() {
  return (
    <div className="mx-auto w-full max-w-lg text-center">
      <h2 className="font-display text-[26px] leading-tight font-semibold text-fg sm:text-[30px]">
        Here&rsquo;s the gist
      </h2>
      <p className="mx-auto mt-2.5 max-w-md text-[14.5px] leading-relaxed text-muted">
        Three things you&rsquo;ll do most. Don&rsquo;t worry about learning them now — we&rsquo;ll
        walk you through each one hands-on right after setup.
      </p>

      <div className="mt-6 flex flex-col gap-3 text-left">
        <Move icon={Check} title="Check things off" sub="Tap the circle on any task in Today.">
          <div className="flex items-center gap-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-accent text-accent">
              <Check size={11} strokeWidth={3} aria-hidden />
            </span>
            <span className="text-[12.5px] font-medium text-fg">Quiz 3 (Ch. 4 & 5)</span>
            <span className="ml-auto text-[11.5px] text-subtle">Due Thu</span>
          </div>
        </Move>

        <Move icon={CalendarDays} title="See your whole term" sub="Your deadlines + campus dates, one calendar.">
          <div className="flex gap-1.5" aria-hidden>
            {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
              <div key={i} className="flex-1 rounded-md border border-border bg-surface-2/60 px-1 py-1 text-center">
                <span className="block text-[9px] text-subtle">{d}</span>
                <span className="mx-auto mt-0.5 block size-1.5 rounded-full" style={{ backgroundColor: i === 2 ? 'var(--ct-accent)' : 'transparent' }} />
              </div>
            ))}
          </div>
        </Move>

        <Move icon={Sparkles} title="Track your standing" sub="Enter a grade — your GPA updates live.">
          <div className="flex items-center gap-2.5">
            <span className="text-[12.5px] font-medium text-fg">Assignment 2</span>
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] font-semibold text-fg tabular-nums">88%</span>
            <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: '88%' }} />
            </div>
          </div>
        </Move>
      </div>
    </div>
  )
}

function Move({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: LucideIcon
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-fg">{title}</p>
          <p className="text-[11.5px] text-subtle">{sub}</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-border/70 bg-surface-2/40 px-3 py-2.5">{children}</div>
    </div>
  )
}
