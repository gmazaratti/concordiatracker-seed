import { Capacitor } from '@capacitor/core'

/**
 * The public address of the site, for any URL a person will SEE, COPY or SEND.
 *
 * In a browser that is simply where the page came from (which also keeps the
 * dev server and preview deployments pointing at themselves). In the App Store
 * app the page comes from `capacitor://localhost`, which means nothing to
 * anyone else: a shared event, an invite, a calendar feed or an API call made
 * from there has to name the real domain.
 */
export const PUBLIC_SITE = 'https://concordiatracker.com'

export function siteOrigin(): string {
  try {
    if (Capacitor.isNativePlatform()) return PUBLIC_SITE
  } catch {
    /* no Capacitor: a browser */
  }
  return typeof window === 'undefined' ? PUBLIC_SITE : window.location.origin
}
