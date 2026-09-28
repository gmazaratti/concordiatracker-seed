import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Keyboard } from '@capacitor/keyboard'
import { PUBLIC_SITE } from './site-origin'
import { inAppPathFor, openIncomingUrl, requestNavigate } from './native-nav'
import { listenForPushTaps } from './native-push'

/**
 * The handful of things the app has to do differently when it is an app.
 *
 * Everything here is a no-op in a browser, so nothing needs a conditional at
 * the call site and the web build is unchanged. Capacitor's own modules are
 * safe to import on the web — they resolve to stubs — so this costs a few
 * kilobytes and no branching.
 */
export const isNative = () => Capacitor.isNativePlatform()

/**
 * Called once React has painted.
 *
 * The splash is dismissed HERE rather than on a timer in the native config: a
 * fixed duration is either too short and shows a white flash, or too long and
 * makes the app feel slow, and it is never right on both an old phone and a new
 * one. Waiting for the first paint is right on every phone.
 */
export async function nativeReady() {
  if (!isNative()) return
  try {
    await SplashScreen.hide()
  } catch {
    /* the splash may already be gone */
  }
}

/**
 * Match the status bar to the theme.
 *
 * `Style.Dark` means dark CONTENT — light glyphs — which is what a dark app
 * wants, and the naming has caught out enough people to be worth stating. Wired
 * to the theme so a student on the light palette does not get white-on-white.
 */
export async function setNativeStatusBar(scheme: 'dark' | 'light') {
  if (!isNative()) return
  try {
    await StatusBar.setStyle({ style: scheme === 'light' ? Style.Light : Style.Dark })
  } catch {
    /* not fatal — the bar just keeps its previous style */
  }
}

/**
 * Open a link the way an app should.
 *
 * A plain external href navigates the WEB VIEW, which takes the student out of
 * the app with no way back — no tab bar, no chrome, nothing. In-app Safari
 * gives them a Done button. Registered on the document so no component has to
 * know about it.
 */
export function interceptExternalLinks() {
  if (!isNative()) return
  document.addEventListener('click', (e) => {
    const anchor = (e.target as HTMLElement | null)?.closest?.('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href || href.startsWith('/') || href.startsWith('#')) return
    let url: URL
    try {
      url = new URL(href, window.location.href)
    } catch {
      return
    }
    if (url.origin === window.location.origin) return
    if (!/^https?:$/.test(url.protocol)) return // mailto:, tel: — let iOS have them
    e.preventDefault()
    // A link to our own site (an event someone shared, a profile) is a page
    // the app already has: open it here, not in a browser tab.
    const own = inAppPathFor(url.href)
    if (own) {
      requestNavigate(own)
      return
    }
    void Browser.open({ url: url.href })
  })
}

/**
 * The hardware/gesture back action.
 *
 * iOS has no back button, but this also fires for the swipe gesture, and the
 * default is to close the app the moment history is empty. Exiting from a
 * screen the student navigated to feels like a crash, so we only exit from the
 * root of the stack.
 */
export function handleAppBack() {
  if (!isNative()) return
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })
}

/**
 * THE API LIVES ON THE WEBSITE, NOT IN THE APP.
 *
 * The app's pages are bundled and served from `capacitor://localhost`, so a
 * relative `fetch('/api/…')` would ask the phone itself, which has no server.
 * Every such call is sent to the real domain instead, in one place, so none of
 * the dozen call sites has to know it might be running in an app. The API
 * answers the app's origin with CORS (middleware.ts + vercel.json).
 */
export function routeApiToSite() {
  if (!isNative()) return
  const original = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return original(PUBLIC_SITE + input, init)
    }
    if (input instanceof URL && input.origin === window.location.origin && input.pathname.startsWith('/api/')) {
      return original(new URL(input.pathname + input.search, PUBLIC_SITE), init)
    }
    return original(input, init)
  }
}

/**
 * The keyboard. The web view already shrinks to make room (capacitor.config),
 * so the page must not ALSO scroll itself to reveal the field: two mechanisms
 * doing one job is what makes a composer jump. The accessory bar (the ‹ › Done
 * strip) stays, because Done is how people expect to dismiss it.
 */
function setUpKeyboard() {
  void Keyboard.setScroll({ isDisabled: true }).catch(() => {})
  void Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {})
}

/**
 * Universal links: a concordiatracker.com URL tapped anywhere else on the
 * phone opens here (public/.well-known/apple-app-site-association). A cold
 * start delivers the URL through `getLaunchUrl`, a warm one through the event.
 */
function handleUniversalLinks() {
  void App.addListener('appUrlOpen', ({ url }) => void openIncomingUrl(url))
  void App.getLaunchUrl()
    .then((r) => {
      if (r?.url) void openIncomingUrl(r.url)
    })
    .catch(() => {})
}

/** Everything above, in the order it should happen. Called from main.tsx. */
export function initNative() {
  if (!isNative()) return
  routeApiToSite()
  interceptExternalLinks()
  handleAppBack()
  setUpKeyboard()
  handleUniversalLinks()
  listenForPushTaps()
}
