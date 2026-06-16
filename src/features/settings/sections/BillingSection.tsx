import { CreditCard, ExternalLink, RefreshCw } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { term } from '@/data/mock'
import { Group, Row } from '../controls'

const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})
const renewal = DATE.format(new Date(term.end))

/** Inline placeholder tag, mirroring the bracketed flags in the legal docs. */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-warning/15 px-1 py-0.5 font-mono text-[11px] font-medium text-warning">
      {children}
    </span>
  )
}

/** Billing: current plan, the explicit auto-renewal disclosure, the Stripe
 * portal, cancellation, and invoices. The demo plan toggle (avatar menu) and the
 * upgrade/cancel buttons here flip the same in-memory plan, so both states show. */
export function BillingSection() {
  const { plan, setPlan } = useAppData()
  const isSemester = plan === 'semester'

  return (
    <div>
      {/* Current plan */}
      <div className="mb-6 rounded-xl border border-border bg-surface-2/25 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-fg">
                {isSemester ? 'Semester pass' : 'Free plan'}
              </span>
              <span
                className={
                  isSemester
                    ? 'rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-success uppercase'
                    : 'rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-subtle uppercase'
                }
              >
                {isSemester ? 'Active' : 'Current'}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {isSemester
                ? 'Full access — GPA prediction, unlimited scans, every feature.'
                : 'Core features, no time limit. Grade-needed calculator included.'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-[20px] leading-none font-semibold text-fg">
              {isSemester ? '$15' : '$0'}
            </span>
            <p className="mt-0.5 text-[11px] text-subtle">
              {isSemester ? '/ semester' : 'forever'}
            </p>
          </div>
        </div>

        {isSemester ? (
          <button
            type="button"
            onClick={() => setPlan('free')}
            className="mt-4 w-full rounded-lg border border-border-strong px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2"
          >
            Cancel subscription
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPlan('semester')}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors hover:bg-accent-hover"
          >
            Upgrade to Semester pass — $15
          </button>
        )}
        <p className="mt-2 text-center text-[11px] text-subtle">
          Checkout is mocked in this seed — no real charge.
        </p>
      </div>

      {/* Auto-renewal disclosure (explicit) */}
      <div className="mb-6 flex gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3.5">
        <RefreshCw size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="text-[12px] leading-relaxed text-muted">
          <p className="font-medium text-fg">Auto-renewal</p>
          <p className="mt-0.5">
            {isSemester ? (
              <>Your Semester pass renews automatically for the next term on{' '}
              <span className="font-medium text-fg">{renewal}</span>.</>
            ) : (
              <>Paid plans renew automatically at the end of each billing period (the
              Semester pass at term end; monthly plans each month).</>
            )}{' '}
            We email you <Tag>[NOTICE PERIOD — TBD]</Tag> before each renewal. Cancel
            anytime here — access continues until the end of the paid period.
          </p>
        </div>
      </div>

      <Group label="Payment">
        <Row label="Payment method" description="Handled by Stripe — we never store card numbers.">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <CreditCard size={14} aria-hidden />
            Manage
            <ExternalLink size={12} className="text-subtle" aria-hidden />
          </button>
        </Row>
        <Row label="Billing provider">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            Stripe <Tag>[VERIFY]</Tag>
          </span>
        </Row>
      </Group>

      <Group label="Invoices">
        {isSemester ? (
          <Row label="Semester pass" description={`Paid · ${renewal}`}>
            <span className="inline-flex items-center gap-2 text-[12px]">
              <span className="text-muted">$15.00</span>
              <button type="button" className="font-medium text-accent hover:underline">
                Receipt
              </button>
            </span>
          </Row>
        ) : (
          <Row label="No invoices yet" description="You're on the free plan." />
        )}
      </Group>
    </div>
  )
}
