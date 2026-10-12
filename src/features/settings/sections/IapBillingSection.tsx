import { useEffect, useState } from 'react'
import { BadgeCheck, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { supabase } from '@/lib/supabase'
import { buyPro, loadProProduct, manageUrl, restorePro, type ProProduct } from '@/lib/iap'
import { siteOrigin } from '@/lib/site-origin'
import { Group } from '../controls'

/**
 * Billing in the iOS app: Pro through Apple In-App Purchase, and nothing else.
 *
 * App Store 3.1.1 / 3.1.2: the subscription is bought here with Apple, the
 * screen names it, its length and its price as the App Store formats it, says
 * that it renews, offers Restore Purchases, and links the Terms of Use (our
 * EULA) and the Privacy Policy. It never mentions another way to pay.
 */
const PERKS = [
  'GPA prediction and what-if',
  'Unlimited syllabus scans',
  'Calendar sync to Google, Apple and Outlook',
  'Every theme and course style',
  'Costs and drop-deadline money planner',
]

/** Outside the component: reading the clock in render is impure. */
async function fetchApple(): Promise<AppleState | null> {
  const { data: s } = await supabase.auth.getSession()
  const uid = s.session?.user.id
  if (!uid) return null
  const { data } = await supabase
    .from('user_profile')
    .select('iap_expires_at, iap_status, iap_will_renew')
    .eq('user_id', uid)
    .maybeSingle()
  return (data as AppleState | null) ?? null
}

function isFuture(iso: string | null | undefined): boolean {
  return !!iso && Date.parse(iso) > Date.now()
}

interface AppleState {
  iap_expires_at: string | null
  iap_status: string | null
  iap_will_renew: boolean | null
}

export function IapBillingSection() {
  const { plan } = useAppData()
  const pro = plan === 'semester'
  const [product, setProduct] = useState<ProProduct | null>(null)
  const [apple, setApple] = useState<AppleState | null>(null)
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    void fetchApple().then((a) => alive && setApple(a))
    loadProProduct()
      .then((p) => alive && setProduct(p))
      .catch((e: unknown) => alive && setLoadError(e instanceof Error ? e.message : 'The App Store did not answer.'))
    return () => {
      alive = false
    }
  }, [])

  const buy = async () => {
    setBusy('buy')
    setError('')
    setNote('')
    try {
      const r = await buyPro()
      if (r === 'pro') setNote('You have Pro. Thank you!')
      else if (r === 'pending') setNote('Your purchase is waiting on Apple. Pro unlocks as soon as it is approved.')
      void fetchApple().then(setApple)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The purchase did not go through.')
    } finally {
      setBusy(null)
    }
  }

  const restore = async () => {
    setBusy('restore')
    setError('')
    setNote('')
    try {
      const ok = await restorePro()
      setNote(ok ? 'Your subscription was restored.' : 'No active subscription was found for this Apple ID.')
      void fetchApple().then(setApple)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore did not go through.')
    } finally {
      setBusy(null)
    }
  }

  const fromApple = isFuture(apple?.iap_expires_at)
  const until = apple?.iap_expires_at
    ? new Date(apple.iap_expires_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col gap-4">
      <Group label="ConcordiaTracker Pro">
        <div className="px-4 py-4">
          {pro ? (
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                <BadgeCheck size={18} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-fg">Pro is active</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-subtle">
                  {fromApple && until
                    ? apple?.iap_will_renew
                      ? `Renews through the App Store on ${until}.`
                      : `Ends on ${until}. It will not renew.`
                    : 'Every Pro feature is unlocked on this account.'}
                </p>
                {fromApple && (
                  <button
                    type="button"
                    onClick={() => void manageUrl().then((url) => import('@capacitor/browser').then(({ Browser }) => Browser.open({ url })))}
                    className="mt-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-fg hover:bg-surface-2"
                  >
                    Manage subscription
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                  <Sparkles size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-fg">{product?.title ?? 'ConcordiaTracker Pro'}</p>
                  <p className="text-[12.5px] text-subtle">
                    {product ? `${product.price} for ${product.period}, auto-renewing` : loadError || 'Loading price…'}
                  </p>
                </div>
              </div>
              <ul className="mt-3 flex flex-col gap-1 text-[13px] text-muted">
                {PERKS.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-accent" aria-hidden>
                      ✓
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={!product || busy !== null}
                onClick={() => void buy()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[14px] font-semibold text-accent-contrast disabled:opacity-60"
              >
                {busy === 'buy' && <Loader2 size={15} className="animate-spin" aria-hidden />}
                {product ? `Subscribe for ${product.price}` : 'Subscribe'}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void restore()}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-[13px] font-medium text-fg hover:bg-surface-2 disabled:opacity-60"
          >
            {busy === 'restore' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RotateCcw size={14} aria-hidden />}
            Restore Purchases
          </button>
          {note && <p role="status" className="mt-2 text-[12.5px] text-success">{note}</p>}
          {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>}
        </div>
      </Group>

      <p className="px-1 text-[11.5px] leading-relaxed text-subtle">
        Payment is charged to your Apple ID when you confirm the purchase. The subscription renews
        automatically for the same length and price unless it is turned off at least 24 hours before the
        current period ends; your account is charged for the renewal within the 24 hours before then. Manage
        or cancel it in your Apple ID&rsquo;s subscription settings.{' '}
        <a href={`${siteOrigin()}/terms`} target="_blank" rel="noopener noreferrer" className="text-accent underline">
          Terms of Use (EULA)
        </a>{' '}
        ·{' '}
        <a href={`${siteOrigin()}/privacy`} target="_blank" rel="noopener noreferrer" className="text-accent underline">
          Privacy Policy
        </a>
      </p>
    </div>
  )
}
