import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CreditCard, Download, Loader2, RefreshCw } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import {
  BILLING_ENABLED,
  billingSummary,
  cancelSubscription,
  fmtDate,
  money,
  resumeSubscription,
  startCardUpdate,
  startCheckout,
  type InvoiceRow,
  type SubscriptionSummary,
} from '@/lib/billing'
import { EmbeddedCheckoutPanel } from '../EmbeddedCheckoutPanel'
import { Group, Row } from '../controls'
import { cn } from '@/lib/cn'

type Pane = null | 'semester' | 'monthly' | 'card'

/** Billing: real Stripe subscription state, embedded checkout, invoices, and
 * cancel/resume — all in-app. Entitlement itself comes from the webhook, so what
 * this shows always matches what Stripe charged. */
export function BillingSection() {
  const { plan } = useAppData()
  const [sub, setSub] = useState<SubscriptionSummary | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(BILLING_ENABLED)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pane, setPane] = useState<Pane>(null)

  const load = useCallback(async () => {
    if (!BILLING_ENABLED) return
    try {
      const data = await billingSummary()
      setSub(data.subscription)
      setInvoices(data.invoices)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load billing.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Wrapped in an async IIFE so no setState runs synchronously in the effect body.
  useEffect(() => {
    let active = true
    void (async () => {
      if (!active) return
      await load()
    })()
    return () => {
      active = false
    }
  }, [load])

  const isPro = plan === 'semester'
  const trialing = sub?.status === 'trialing'
  const pastDue = sub?.status === 'past_due' || sub?.status === 'unpaid'

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* Current plan */}
      <div className="mb-6 rounded-xl border border-border bg-surface-2/25 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-fg">
                {isPro ? 'ConcordiaTracker Pro' : 'Free plan'}
              </span>
              <StatusChip status={sub?.status} isPro={isPro} />
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {isPro
                ? 'Full access — GPA prediction, unlimited scans, every feature.'
                : 'Core features, no time limit. Grade-needed calculator included.'}
            </p>
            {trialing && sub?.trialEnd && (
              <p className="mt-1 text-[12px] font-medium text-accent">
                Free trial — your card is charged {fmtDate(sub.trialEnd)}.
              </p>
            )}
            {sub?.cancelAtPeriodEnd && (
              <p className="mt-1 text-[12px] font-medium text-warning">
                Cancels {fmtDate(sub.currentPeriodEnd)} — you keep access until then.
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <span className="text-[20px] leading-none font-semibold text-fg">
              {sub?.amount != null ? money(sub.amount, sub.currency) : isPro ? '—' : '$0'}
            </span>
            <p className="mt-0.5 text-[11px] text-subtle">
              {sub?.interval ? `/ ${sub.interval}` : isPro ? '' : 'forever'}
            </p>
          </div>
        </div>

        {pastDue && (
          <div className="mt-3 flex gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>Your last payment failed. Update your card to keep Pro.</span>
          </div>
        )}

        {!BILLING_ENABLED ? (
          <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2.5 text-center text-[12px] text-subtle">
            Payments aren&rsquo;t configured in this environment.
          </p>
        ) : loading ? (
          <div className="mt-4 grid place-items-center py-3">
            <Loader2 className="size-4 animate-spin text-accent" aria-label="Loading" />
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {/* Subscribe / manage */}
            {!sub || sub.status === 'canceled' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPane(pane === 'semester' ? null : 'semester')}
                  className="w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  Get the Semester pass — $15
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPane(pane === 'monthly' ? null : 'monthly')}
                  className="w-full rounded-lg border border-border-strong px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  Or go monthly — $5 / month
                </button>
              </>
            ) : sub.cancelAtPeriodEnd ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(resumeSubscription)}
                className="w-full rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Resume subscription'}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(cancelSubscription)}
                className="w-full rounded-lg border border-border-strong px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Cancel subscription'}
              </button>
            )}

            {/* Embedded checkout — in-app (its own overlay), never a second tab. */}
            {(pane === 'semester' || pane === 'monthly') && (
              <EmbeddedCheckoutPanel
                title={pane === 'semester' ? 'Semester pass' : 'Monthly plan'}
                onClose={() => {
                  setPane(null)
                  // Re-read in case they completed payment — the webhook may have
                  // already flipped the plan while the form was open.
                  void load()
                }}
                fetchClientSecret={async () => (await startCheckout(pane)).clientSecret}
              />
            )}
          </div>
        )}

        {error && <p className="mt-2 text-center text-[12px] text-danger">{error}</p>}
      </div>

      {/* Auto-renewal disclosure (explicit) */}
      <div className="mb-6 flex gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3.5">
        <RefreshCw size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="text-[12px] leading-relaxed text-muted">
          <p className="font-medium text-fg">Auto-renewal</p>
          <p className="mt-0.5">
            {sub && !sub.cancelAtPeriodEnd ? (
              <>
                Renews automatically on{' '}
                <span className="font-medium text-fg">{fmtDate(sub.currentPeriodEnd)}</span>.
              </>
            ) : (
              <>
                Paid plans renew automatically at the end of each billing period (the Semester pass
                at term end; monthly plans each month).
              </>
            )}{' '}
            Cancel anytime here — access continues until the end of the paid period.
          </p>
        </div>
      </div>

      <Group label="Payment">
        <Row label="Payment method" description="Handled by Stripe — we never see or store card numbers.">
          <button
            type="button"
            disabled={!BILLING_ENABLED || busy}
            onClick={() => setPane(pane === 'card' ? null : 'card')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            <CreditCard size={14} aria-hidden />
            Update card
          </button>
        </Row>
      </Group>

      {/* Renders as its own overlay (portalled), so placement here is incidental. */}
      {pane === 'card' && (
        <EmbeddedCheckoutPanel
          title="Update payment method"
          onClose={() => setPane(null)}
          fetchClientSecret={async () => (await startCardUpdate()).clientSecret}
        />
      )}

      <Group label="Invoices">
        {invoices.length === 0 ? (
          <Row
            label="No invoices yet"
            description={isPro ? 'Your first invoice will appear here.' : "You're on the free plan."}
          />
        ) : (
          invoices.map((inv) => (
            <Row
              key={inv.id}
              label={inv.number || 'Invoice'}
              description={`${statusWord(inv.status)} · ${fmtDate(inv.created)}`}
            >
              <span className="inline-flex items-center gap-2 text-[12px]">
                <span className="text-muted tabular-nums">{money(inv.amountPaid, inv.currency)}</span>
                {inv.pdf && (
                  <a
                    href={inv.pdf}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                  >
                    <Download size={12} aria-hidden />
                    PDF
                  </a>
                )}
              </span>
            </Row>
          ))
        )}
      </Group>
    </div>
  )
}

function statusWord(status: string | null): string {
  if (status === 'paid') return 'Paid'
  if (status === 'open') return 'Due'
  if (status === 'void') return 'Void'
  if (status === 'uncollectible') return 'Unpaid'
  return status ? status[0].toUpperCase() + status.slice(1) : 'Invoice'
}

function StatusChip({ status, isPro }: { status?: string; isPro: boolean }) {
  const label =
    status === 'trialing'
      ? 'Trial'
      : status === 'active'
        ? 'Active'
        : status === 'past_due' || status === 'unpaid'
          ? 'Payment failed'
          : status === 'canceled'
            ? 'Canceled'
            : isPro
              ? 'Active'
              : 'Current'
  const tone =
    label === 'Payment failed'
      ? 'bg-danger/15 text-danger'
      : label === 'Trial'
        ? 'bg-accent-soft text-accent'
        : label === 'Active'
          ? 'bg-success/15 text-success'
          : 'bg-surface-2 text-subtle'
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase', tone)}>
      {label}
    </span>
  )
}
