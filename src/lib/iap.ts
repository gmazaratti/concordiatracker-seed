import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

/**
 * Pro through Apple In-App Purchase, in the iOS app only (App Store 3.1.1).
 *
 * The RevenueCat SDK is loaded lazily and only in the native shell, so the web
 * bundle never carries it and the website keeps selling through Stripe. The
 * customer is identified by the Supabase user id (`logIn`), which is what lets
 * the server (api/_revenuecat.ts) put an Apple purchase on the same account
 * that a Stripe purchase would have used: Pro bought either way is Pro
 * everywhere.
 *
 * The public iOS key comes from VITE_REVENUECAT_IOS_KEY. Without it every call
 * here reports "not available" instead of throwing, so a build without the key
 * shows an honest message rather than a broken button.
 */
export const IAP_AVAILABLE: boolean = (() => {
  try {
    return Capacitor.getPlatform() === 'ios'
  } catch {
    return false
  }
})()

const KEY = (import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined) ?? ''

export interface ProProduct {
  /** As the App Store formats it for this person, e.g. "CA$14.99". */
  price: string
  /** "6 months". */
  period: string
  title: string
}

type Sdk = typeof import('@revenuecat/purchases-capacitor')['Purchases']
type Pkg = import('@revenuecat/purchases-capacitor').PurchasesPackage

let sdk: Promise<Sdk> | null = null
let configuredFor: string | null = null

async function purchases(): Promise<Sdk> {
  if (!IAP_AVAILABLE || !KEY) throw new Error('In-app purchases are not available in this build.')
  sdk ??= import('@revenuecat/purchases-capacitor').then((m) => m.Purchases)
  const P = await sdk
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) throw new Error('Sign in first.')
  if (configuredFor === null) {
    const { isConfigured } = await P.isConfigured()
    if (!isConfigured) await P.configure({ apiKey: KEY, appUserID: uid })
    else await P.logIn({ appUserID: uid })
    configuredFor = uid
  } else if (configuredFor !== uid) {
    await P.logIn({ appUserID: uid })
    configuredFor = uid
  }
  return P
}

function periodLabel(iso: string | null | undefined): string {
  const m = /^P(\d+)([DWMY])$/.exec(iso ?? '')
  if (!m) return '6 months'
  const n = Number(m[1])
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[m[2] as 'D' | 'W' | 'M' | 'Y']
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

let pkg: Pkg | null = null

/** The Pro subscription as the App Store prices it for this person. */
export async function loadProProduct(): Promise<ProProduct> {
  const P = await purchases()
  const offerings = await P.getOfferings()
  const current = offerings.current
  pkg = current?.sixMonth ?? current?.availablePackages[0] ?? null
  if (!pkg) throw new Error('The subscription is not available right now. Try again later.')
  return {
    price: pkg.product.priceString,
    period: periodLabel(pkg.product.subscriptionPeriod),
    title: pkg.product.title || 'ConcordiaTracker Pro',
  }
}

/** Ask our server to read RevenueCat now, so Pro unlocks without waiting for the webhook. */
async function syncServer(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return false
  const res = await fetch('/api/stripe-billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'iap-sync' }),
  }).catch(() => null)
  const json = (await res?.json().catch(() => null)) as { pro?: boolean } | null
  return !!json?.pro
}

export type BuyResult = 'pro' | 'cancelled' | 'pending'

/** Buy Pro. Resolves 'cancelled' when the person backs out of Apple's sheet. */
export async function buyPro(): Promise<BuyResult> {
  const P = await purchases()
  if (!pkg) await loadProProduct()
  try {
    const { customerInfo } = await P.purchasePackage({ aPackage: pkg as Pkg })
    const active = !!customerInfo.entitlements.active.pro
    await syncServer()
    return active ? 'pro' : 'pending'
  } catch (e) {
    if ((e as { userCancelled?: boolean | null })?.userCancelled) return 'cancelled'
    throw e instanceof Error ? e : new Error('The purchase did not go through.')
  }
}

/** Restore Purchases, which Apple requires: a subscription bought on another device or account. */
export async function restorePro(): Promise<boolean> {
  const P = await purchases()
  const { customerInfo } = await P.restorePurchases()
  const active = !!customerInfo.entitlements.active.pro
  const server = await syncServer()
  return active || server
}

/** Apple's own subscription management page. */
export async function manageUrl(): Promise<string> {
  try {
    const P = await purchases()
    const { customerInfo } = await P.getCustomerInfo()
    return customerInfo.managementURL ?? 'https://apps.apple.com/account/subscriptions'
  } catch {
    return 'https://apps.apple.com/account/subscriptions'
  }
}

/** Forget the RevenueCat customer on sign-out, so the next account starts clean. */
supabase.auth.onAuthStateChange((event) => {
  if (event !== 'SIGNED_OUT' || !sdk || configuredFor === null) return
  configuredFor = null
  void sdk.then((P) => P.logOut()).catch(() => {})
})
