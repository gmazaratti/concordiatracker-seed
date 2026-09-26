import { useEffect, useState } from 'react'
import { ErrorState, Loading, RefreshButton } from '../admin-ui'
import { cn } from '@/lib/cn'
import { loadProduct, type ProductBundle } from './product-data'
import {
  ActivationPanel,
  AdoptionPanel,
  ChannelPanel,
  ChurnPanel,
  CohortPanel,
  EmailPanel,
  InvitePanel,
  ParsePanel,
} from './ProductSections'

const RANGES = [30, 90, 365] as const

/**
 * Admin → Product. The eight product questions in one place: where signups
 * come from, whether they activate, which features are used, whether invites
 * become clubs, whether email lands, whether parsing works, who comes back,
 * and why people leave.
 *
 * Most of this is only collected from the day db/product_analytics.sql ran,
 * so early numbers are small; the activation panel says so rather than
 * comparing against months that were never measured.
 */
export function ProductTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(90)
  const [data, setData] = useState<ProductBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      setBusy(true)
      try {
        const d = await loadProduct(days)
        if (active) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setBusy(false)
      }
    })()
    return () => {
      active = false
    }
  }, [days, tick])

  if (error && !data) return <ErrorState message={error} />
  if (!data) return <Loading />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[22px] font-semibold text-fg">Product</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={days === r}
                onClick={() => setDays(r)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[12px] font-medium',
                  days === r ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {r === 365 ? '1 year' : `${r} days`}
              </button>
            ))}
          </div>
          <RefreshButton onClick={() => setTick((n) => n + 1)} busy={busy} />
        </div>
      </div>
      {data.product.tracking_since && (
        <p className="-mt-3 text-[12px] text-subtle">
          Product events recorded since {new Date(data.product.tracking_since).toLocaleDateString()}. Internal
          accounts and people who opted out are never counted.
        </p>
      )}
      <ActivationPanel r={data.product} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ChannelPanel r={data.product} />
        <AdoptionPanel r={data.product} />
      </div>
      <CohortPanel c={data.cohorts} />
      <div className="grid gap-5 lg:grid-cols-2">
        <InvitePanel f={data.invites} />
        <EmailPanel e={data.email} />
      </div>
      <ParsePanel p={data.parse} />
      <ChurnPanel c={data.churn} />
    </div>
  )
}
