import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { STRIPE_TEST_MODE } from '@/lib/billing'
import { useT } from '@/i18n/i18n'

/** Pricing: the semester pass is the hero (one price for the whole term); the
 * monthly is the quiet secondary. The free/paid line is made tangible — the
 * grade-needed calculator is free, GPA prediction is the paid unlock. */
export function PricingSection() {
  const t = useT()
  const freeFeatures = [t('pricing.free1'), t('pricing.free2'), t('pricing.free3'), t('pricing.free4')]
  const paidFeatures = [t('pricing.paid1'), t('pricing.paid2'), t('pricing.paid3'), t('pricing.paid4')]
  return (
    <section id="pricing" className="border-t border-border/60 px-5 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[13px] font-semibold tracking-wide text-accent uppercase">
            {t('landing.pricing')}
          </span>
          <h2 className="mt-3 font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.05] font-medium text-fg">
            {t('pricing.heading')}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            {t('pricing.sub')}
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl items-start gap-5 md:grid-cols-2">
          {/* Free */}
          <PlanCard
            name={t('pricing.free')}
            price="$0"
            cadence={t('pricing.always')}
            blurb={t('pricing.freeBlurb')}
            features={freeFeatures}
            cta={t('pricing.freeCta')}
          />

          {/* Semester: hero */}
          <PlanCard
            featured
            name={t('pricing.semester')}
            price="$15"
            cadence={t('pricing.perSemester')}
            secondary={t('pricing.orMonthly')}
            blurb={t('pricing.semesterBlurb')}
            features={paidFeatures}
            cta={t('pricing.semesterCta')}
          />
        </div>

        <p className="mt-6 text-center text-[12px] text-subtle">
          {STRIPE_TEST_MODE ? t('pricing.testModeNote') : t('pricing.liveNote')}
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
  const bestValue = useT()('pricing.bestValue')
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
          {bestValue}
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
