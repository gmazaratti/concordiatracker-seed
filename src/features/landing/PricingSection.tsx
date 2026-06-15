import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const FREE_FEATURES = [
  'Parse any syllabus into dated deadlines',
  'Track every course, weight & status',
  'Grade-needed-to-pass calculator',
  'Provenance on every date',
]

const PAID_FEATURES = [
  'Everything in Free',
  'GPA what-if predictor & projections',
  'Full-term standing across all courses',
  'Earn theme credits for contributing outlines',
]

/** Pricing: the semester pass is the hero (one price for the whole term); the
 * monthly is the quiet secondary. The free/paid line is made tangible — the
 * grade-needed calculator is free, GPA prediction is the paid unlock. */
export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border/60 px-5 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[13px] font-semibold tracking-wide text-accent uppercase">
            Pricing
          </span>
          <h2 className="mt-3 font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.05] font-medium text-fg">
            One pass. The whole semester.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Priced like a student, not a SaaS. Pay once for the term — or month to
            month if you'd rather.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl items-start gap-5 md:grid-cols-2">
          {/* Free */}
          <PlanCard
            name="Free"
            price="$0"
            cadence="always"
            blurb="Everything you need to stay on top of the term."
            features={FREE_FEATURES}
            cta="Open the app"
          />

          {/* Semester — hero */}
          <PlanCard
            featured
            name="Semester pass"
            price="$15"
            cadence="/ semester"
            secondary="or $5 / month"
            blurb="The full picture — every projection unlocked."
            features={PAID_FEATURES}
            cta="Get the semester pass"
          />
        </div>

        <p className="mt-6 text-center text-[12px] text-subtle">
          Mock checkout — this is a seed build. No card is charged.
        </p>
      </div>
    </section>
  )
}

function PlanCard({
  name,
  price,
  cadence,
  secondary,
  blurb,
  features,
  cta,
  featured = false,
}: {
  name: string
  price: string
  cadence: string
  secondary?: string
  blurb: string
  features: string[]
  cta: string
  featured?: boolean
}) {
  return (
    <div
      className={cn(
        'relative flex h-full flex-col rounded-2xl border p-6 sm:p-7',
        featured
          ? 'border-accent/40 bg-gradient-to-b from-accent-soft to-surface shadow-[0_0_0_1px_var(--ct-accent-ring),0_24px_60px_-30px_rgba(0,0,0,0.7)]'
          : 'border-border bg-surface',
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-contrast">
          Best value
        </span>
      )}
      <h3 className="text-[15px] font-semibold text-fg">{name}</h3>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[40px] leading-none font-medium text-fg">{price}</span>
        <span className="text-[13px] text-subtle">{cadence}</span>
      </div>
      {secondary && <p className="mt-1 text-[12px] text-accent">{secondary}</p>}
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{blurb}</p>

      <ul className="mt-5 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13px] text-muted">
            <Check
              size={15}
              className={cn('mt-0.5 shrink-0', featured ? 'text-accent' : 'text-success')}
            />
            {f}
          </li>
        ))}
      </ul>

      <Link to="/app" className="mt-6 block">
        <Button variant={featured ? 'primary' : 'outline'} size="md" className="w-full">
          {cta}
        </Button>
      </Link>
    </div>
  )
}
