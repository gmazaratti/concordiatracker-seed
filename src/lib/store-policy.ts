import { Capacitor } from '@capacitor/core'

/**
 * WHAT THE NATIVE APP MAY SAY ABOUT MONEY: ONLY APPLE'S IN-APP PURCHASE.
 *
 * Since October 2026 the App Store build sells Pro itself, through Apple In-App
 * Purchase (lib/iap.ts, Settings → Billing = IapBillingSection). What it must
 * never do (App Store 3.1.1 / 3.1.3) is mention or link to the website's Stripe
 * checkout, its prices, or any other way to pay. So in the native shell:
 *   - every "Upgrade" button opens the in-app purchase screen;
 *   - web pricing, the Stripe billing screen, Stripe celebrations, marketing
 *     pages and release notes about web billing stay hidden.
 *
 * An account that already has Pro from the website keeps it here (allowed for
 * multiplatform services, 3.1.3(b)); the app just never says where it came from.
 *
 * Read once at module load: whether we are running in the native shell cannot
 * change during a session, and a constant is what lets every caller branch
 * without a hook. The name predates IAP: read it as "web purchasing hidden".
 */
export const PURCHASES_HIDDEN: boolean = (() => {
  try {
    if (Capacitor.isNativePlatform()) return true
    // Dev servers only: `localStorage.ct_force_native = '1'` previews the App
    // Store build in a browser. `import.meta.env.DEV` is false in every
    // production bundle, so this cannot be switched on for real users.
    return import.meta.env.DEV && localStorage.getItem('ct_force_native') === '1'
  } catch {
    return false
  }
})()

/**
 * Words that mark text as being about buying something. Used to drop lines of
 * copy we did not write for the app (release notes, which describe web-only
 * changes like pricing) rather than to censor anything the student wrote.
 */
const MONEY_WORDS =
  /\b(pro|semester pass|pass|subscri\w*|trials?|pricing|prices?|checkout|billing|upgrade\w*|stripe|renew\w*|refund\w*|paid|paying|payment\w*|buy|buying|bought|purchas\w*)\b|\$\d/i

/** True when this line of product copy is safe to show inside the native app. */
export function copyAllowedInApp(text: string): boolean {
  return !PURCHASES_HIDDEN || !MONEY_WORDS.test(text)
}
