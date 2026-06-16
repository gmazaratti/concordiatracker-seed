import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Calculator, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AppPreview } from './AppPreview'
import { ParseShowcase } from './ParseShowcase'
import { PricingSection } from './PricingSection'

const FEATURES = [
  {
    icon: ScanLine,
    title: 'Parse, don’t transcribe',
    body: 'Upload a syllabus and the deadlines, weights, and exams land in your term automatically — no copying into a calendar by hand.',
  },
  {
    icon: Calculator,
    title: 'Grade math that’s real',
    body: 'A working grade-needed-to-pass calculator and a GPA what-if slider. Actual arithmetic — free where it counts most.',
  },
  {
    icon: BadgeCheck,
    title: 'Trust every date',
    body: 'Provenance badges show whether a date is official, confirmed by classmates, or still unverified. You always know what to trust.',
  },
]

/** The public marketing landing. Composition is deliberately asymmetric and
 * varies section to section (Linear-influenced): a left-aligned hero whose real
 * Today dashboard bleeds off the right edge for depth, an editorial divider-ruled
 * feature row (no cards), the syllabus parse beat, pricing, and an offset CTA. */
export function LandingPage() {
  return (
    <>
      {/* ---- Hero: copy left, the real dashboard bleeds off the right ---- */}
      <section className="relative overflow-hidden px-5 pt-16 pb-20 sm:pt-24 lg:pb-28">
        <div className="ct-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] bg-[radial-gradient(ellipse_48%_45%_at_28%_-5%,var(--ct-accent-soft),transparent_70%)]"
          aria-hidden
        />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 lg:flex-row lg:items-center lg:gap-10">
          {/* Copy */}
          <div className="w-full lg:w-[46%] lg:flex-none">
            <p className="text-[12px] font-medium tracking-[0.22em] text-subtle uppercase">
              For Concordia students
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.02] font-medium tracking-tight text-fg">
              Stop guessing
              <br />
              what&rsquo;s <span className="text-accent">due</span>.
            </h1>
            <p className="mt-6 max-w-md text-[clamp(1rem,1.4vw,1.18rem)] leading-relaxed text-muted">
              ConcordiaTracker turns your syllabi into a live plan — every
              deadline, grade calculation, and GPA projection for all your
              classes, in one calm dashboard.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/app" className="w-full sm:w-auto">
                <Button size="lg" className="group w-full sm:w-auto">
                  Open the live demo
                  <ArrowRight
                    size={17}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </Button>
              </Link>
              <a href="#how" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  See how it works
                </Button>
              </a>
            </div>
            <p className="mt-5 text-[12.5px] text-subtle">
              No sign-up — jump straight into a real demo term.
            </p>
          </div>

          {/* Preview — overruns the right viewport edge to signal depth, but capped
              so it never stretches the dashboard on ultra-wide screens. The right
              rounded corner sits off-screen while it bleeds and only becomes visible
              once the cap turns it into a contained card on very wide viewports. */}
          <div className="relative w-full lg:w-[60vw] lg:max-w-[820px] lg:flex-none">
            <div className="ct-slide-in-right overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_-1px_0_0_var(--ct-border-strong),0_40px_120px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
                <span className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-danger/70" />
                  <span className="size-2.5 rounded-full bg-warning/70" />
                  <span className="size-2.5 rounded-full bg-success/70" />
                </span>
                <span className="ml-3 flex items-center gap-1.5 rounded-md border border-border bg-canvas/60 px-3 py-1 text-[11px] text-subtle">
                  concordiatracker.com/today
                </span>
              </div>
              <div className="h-[440px] overflow-hidden sm:h-[520px] lg:h-[560px]" aria-hidden>
                <div className="pointer-events-none h-full select-none">
                  <AppPreview />
                </div>
              </div>
            </div>
            {/* on mobile, fade the foot so it reads as "more below" */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-canvas lg:hidden" />
          </div>
        </div>

        {/* on desktop, soften the embed's bleeding right edge into the canvas */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-40 bg-gradient-to-r from-transparent to-canvas lg:block"
          aria-hidden
        />
      </section>

      {/* ---- Features: an editorial, divider-ruled row — not cards ---- */}
      <section className="border-t border-border/60 px-5 py-24 sm:py-32">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
            <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.1] font-medium text-fg">
              Three things most trackers get wrong.
            </h2>
            <div className="lg:pt-2">
              <p className="text-[12px] font-medium tracking-[0.22em] text-subtle uppercase">
                Why it&rsquo;s different
              </p>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
                Most tools make you do the work twice. ConcordiaTracker reads the
                syllabus, does the math, and tells you exactly what to trust.
              </p>
            </div>
          </div>

          <div className="mt-16 grid gap-y-12 sm:grid-cols-3 sm:gap-x-0">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className="sm:border-l sm:border-border sm:px-8 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-medium tracking-wider text-subtle tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <span className="mt-6 inline-grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-[16px] font-semibold text-fg">{title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Parse + provenance (kept as-is) ---- */}
      <ParseShowcase />

      {/* ---- Pricing ---- */}
      <PricingSection />

      {/* ---- Final CTA: offset, baseline-aligned, no card ---- */}
      <section className="relative overflow-hidden border-t border-border/60 px-5 py-28 sm:py-36">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_45%_100%_at_72%_0%,var(--ct-accent-soft),transparent_70%)]"
          aria-hidden
        />
        <div className="mx-auto grid w-full max-w-6xl items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <h2 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.04] font-medium text-fg">
            Your term&rsquo;s
            <br />
            already in motion.
          </h2>
          <div className="lg:pb-2">
            <p className="max-w-sm text-[15px] leading-relaxed text-muted">
              See exactly what&rsquo;s due, what it&rsquo;s worth, and where your
              grade stands — in about ten seconds.
            </p>
            <Link to="/app" className="mt-6 inline-block">
              <Button size="lg" className="group">
                Open the live demo
                <ArrowRight
                  size={17}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
