import { Capacitor } from '@capacitor/core'

/**
 * WHAT THE NATIVE APP MAY SAY ABOUT MONEY: NOTHING.
 *
 * The App Store build does not sell anything. Apple's rules (3.1.1 / 3.1.3)
 * forbid unlocking features with a purchase made outside the app from inside
 * the app, and forbid pointing people at one. So in the native shell there is
 * no upgrade button, no price, no plan name, no "comes with the Semester pass",
 * and no link to where one could be bought.
 *
 * An account that already has Pro (bought on the web) keeps every Pro feature
 * here, silently: the app reflects what the account is, it just never talks
 * about how it got that way.
 *
 * A FREE account in the app does not see Pro features at all rather than
 * seeing them locked. A padlock is itself an invitation to buy, and a locked
 * card with no way to unlock it is a dead end.
 *
 * Read once at module load: whether we are running in the native shell cannot
 * change during a session, and a constant is what lets every caller branch
 * without a hook.
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
