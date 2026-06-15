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

/** The public marketing landing. Bold, value-first, dark: a confident hero whose
 * fold "peeks" the real Today dashboard (the actual product UI, not a screenshot),
 * then the syllabus parse-reveal beat, the provenance system, and pricing. */
export function LandingPage() {
  return (
    <>
      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden px-5 pt-16 pb-0 sm:pt-24">
        {/* ambient backdrop */}
        <div className="ct-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_55%_45%_at_50%_-5%,var(--ct-accent-soft),transparent_70%)]"
          aria-hidden
        />

        <div className="mx-auto w-full max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 py-1.5 text-[12.5px] font-medium text-muted backdrop-blur">
            <span className="size-1.5 rounded-full bg-accent" />
            Built for Concordia students
          </span>

          <h1 className="mt-6 font-display text-[clamp(2.6rem,7vw,4.75rem)] leading-[1.02] font-medium tracking-tight text-fg">
            Stop guessing
            <br />
            what&rsquo;s <span className="text-accent">due</span>.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[clamp(1rem,2.2vw,1.2rem)] leading-relaxed text-muted">
            ConcordiaTracker turns your syllabi into a live plan — every deadline,
            grade calculation, and GPA projection for all your classes, in one calm
            dashboard.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/app">
              <Button size="lg" className="group">
                Open the live demo
                <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <a href="#how">
              <Button variant="outline" size="lg">
                See how it works
              </Button>
            </a>
          </div>
          <p className="mt-4 text-[12.5px] text-subtle">
            No sign-up — jump straight into a real demo term.
          </p>
        </div>

        {/* ---- The peek: real Today dashboard in a browser frame ---- */}
        <div className="relative mx-auto mt-16 w-full max-w-5xl sm:mt-20">
          <div className="ct-rise overflow-hidden rounded-t-2xl border border-border bg-surface shadow-[0_-1px_0_0_var(--ct-border-strong),0_40px_120px_-40px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-danger/70" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-success/70" />
              </span>
              <span className="mx-auto flex items-center gap-1.5 rounded-md border border-border bg-canvas/60 px-3 py-1 text-[11px] text-subtle">
                concordiatracker.app/today
              </span>
            </div>
            <div className="h-[440px] overflow-hidden sm:h-[520px]" aria-hidden>
              <div className="pointer-events-none h-full select-none">
                <AppPreview />
              </div>
            </div>
          </div>
          {/* fade the frame into the page so it reads as "more below the fold" */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-canvas" />
        </div>
      </section>

      {/* ---- Feature trio ---- */}
      <section className="px-5 py-20 sm:py-28">
        <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon size={20} />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold text-fg">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Parse + provenance ---- */}
      <ParseShowcase />

      {/* ---- Pricing ---- */}
      <PricingSection />

      {/* ---- Final CTA ---- */}
      <section className="px-5 pb-24">
        <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface to-canvas px-6 py-16 text-center sm:py-20">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,var(--ct-accent-soft),transparent_70%)]"
            aria-hidden
          />
          <h2 className="font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] font-medium text-fg">
            Your term&rsquo;s already in motion.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            See exactly what&rsquo;s due, what it&rsquo;s worth, and where your grade
            stands — in about ten seconds.
          </p>
          <Link to="/app" className="mt-8 inline-block">
            <Button size="lg" className="group">
              Open the live demo
              <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  )
}
