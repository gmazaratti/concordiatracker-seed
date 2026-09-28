import { registerPlugin } from '@capacitor/core'
import { supabase } from './supabase'
import { consumeAuthLink } from './native-nav'

/**
 * Google and Apple sign-in in the App Store app, through the SYSTEM sign-in
 * sheet (ASWebAuthenticationSession) rather than inside the app's web view.
 *
 * Google refuses OAuth inside an embedded web view outright
 * ("disallowed_useragent"), and App Review expects the system sheet for any
 * third-party sign-in anyway: it is the one surface where the person can see
 * the real address bar and their existing Safari session, and where the app
 * cannot read what they type.
 *
 * The flow:
 *   1. supabase-js builds the provider URL but does not navigate
 *      (skipBrowserRedirect), with a redirect back to our custom scheme.
 *   2. The native plugin (ios/App/App/NativeAuthPlugin.swift) opens that URL
 *      in the sheet and waits for the scheme to be called.
 *   3. The callback URL comes back here; its tokens become the session.
 *
 * THE REDIRECT URL MUST BE ALLOW-LISTED in Supabase (Authentication → URL
 * Configuration → Redirect URLs), or Supabase silently sends the sheet to the
 * Site URL instead and it never comes back.
 */
export const AUTH_CALLBACK_SCHEME = 'com.concordiatracker.app'
export const AUTH_CALLBACK_URL = `${AUTH_CALLBACK_SCHEME}://auth-callback`

interface NativeAuthPlugin {
  start(options: { url: string; callbackScheme: string }): Promise<{ url: string }>
}

const NativeAuth = registerPlugin<NativeAuthPlugin>('NativeAuth')

export type NativeOAuthResult = { error: string | null; cancelled?: boolean }

/** The provider said no (or the person did), in words from the callback. */
function callbackError(raw: string): string | null {
  try {
    const url = new URL(raw)
    const params = new URLSearchParams(url.hash.replace(/^#/, ''))
    for (const [k, v] of url.searchParams) params.set(k, v)
    const err = params.get('error_description') ?? params.get('error')
    return err ? err.replace(/\+/g, ' ') : null
  } catch {
    return null
  }
}

export async function nativeOAuth(
  provider: 'google' | 'apple',
  mode: 'signIn' | 'link' = 'signIn',
): Promise<NativeOAuthResult> {
  const options = { redirectTo: AUTH_CALLBACK_URL, skipBrowserRedirect: true }
  const res =
    mode === 'link'
      ? await supabase.auth.linkIdentity({ provider, options })
      : await supabase.auth.signInWithOAuth({ provider, options })
  if (res.error) return { error: res.error.message }
  const providerUrl = res.data?.url
  if (!providerUrl) return { error: 'Sign-in could not start. Try again.' }

  let callback: string
  try {
    callback = (await NativeAuth.start({ url: providerUrl, callbackScheme: AUTH_CALLBACK_SCHEME })).url
  } catch (e) {
    // Closing the sheet is a choice, not a failure: no message.
    const message = e instanceof Error ? e.message : String(e)
    if (/cancel/i.test(message)) return { error: null, cancelled: true }
    return { error: 'Sign-in could not open. Try again.' }
  }

  const refused = callbackError(callback)
  if (refused) return { error: refused }
  const done = await consumeAuthLink(callback)
  return done.signedIn ? { error: null } : { error: 'Sign-in did not finish. Try again.' }
}
