import { supabase } from './supabase'
import { PUBLIC_SITE } from './site-origin'

/**
 * Getting from "the app was asked to open something" to the right screen.
 *
 * Three things ask: a universal link (a concordiatracker.com URL tapped in
 * Mail or Messages, see public/.well-known/apple-app-site-association), a tap
 * on a notification, and a link inside the app that points at our own site.
 * All three can arrive before React has mounted (a cold start), so the path
 * waits here until the router takes it.
 *
 * Links that carry a SESSION need one more step first. A password-reset or
 * email-confirmation link lands with the tokens in the fragment; the web build
 * lets supabase-js read them from the address bar at load, but a link opened
 * into an already-running app never changes the address bar, so the tokens are
 * applied here before navigating.
 */

let pending: string | null = null
const EVENT = 'ct:native-navigate'

/** Queue an in-app path for the router. */
export function requestNavigate(path: string): void {
  pending = path
  window.dispatchEvent(new Event(EVENT))
}

/** The router side: take the waiting path (once) and follow new ones. */
export function onNavigateRequest(navigate: (path: string) => void): () => void {
  const take = () => {
    const path = pending
    pending = null
    if (path) navigate(path)
  }
  take()
  window.addEventListener(EVENT, take)
  return () => window.removeEventListener(EVENT, take)
}

/** Only our own site becomes an in-app path. Anything else is ignored. */
export function inAppPathFor(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const site = new URL(PUBLIC_SITE)
  const host = url.hostname.replace(/^www\./, '')
  if (url.protocol !== 'https:' || host !== site.hostname) return null
  return `${url.pathname}${url.search}` || '/app'
}

/**
 * Apply the tokens an auth link carries, if it carries any. Returns where the
 * person should land: a recovery link goes to the reset form whatever path it
 * named, because that is the one thing the link exists for.
 */
export async function consumeAuthLink(raw: string): Promise<{ signedIn: boolean; recovery: boolean }> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { signedIn: false, recovery: false }
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const query = url.searchParams
  const type = hash.get('type') ?? query.get('type')
  const recovery = type === 'recovery'

  const access = hash.get('access_token')
  const refresh = hash.get('refresh_token')
  if (access && refresh) {
    const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh })
    return { signedIn: !error, recovery }
  }
  const code = query.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return { signedIn: !error, recovery }
  }
  return { signedIn: false, recovery }
}

/** A concordiatracker.com URL the system handed the app (a universal link). */
export async function openIncomingUrl(raw: string): Promise<void> {
  const path = inAppPathFor(raw)
  if (!path) return
  const auth = await consumeAuthLink(raw)
  if (auth.recovery) {
    requestNavigate('/reset-password')
    return
  }
  // The fragment is dropped on purpose: it carried the tokens, and a token left
  // in history is a token someone can read back out of it.
  requestNavigate(path)
}
