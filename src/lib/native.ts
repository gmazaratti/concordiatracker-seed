import { Capacitor, registerPlugin } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Keyboard } from '@capacitor/keyboard'
import { PUBLIC_SITE } from './site-origin'
import { inAppPathFor, openIncomingUrl, requestNavigate } from './native-nav'
import { listenForPushTaps } from './native-push'
import { listenForReminderTaps } from './assignment-reminders'

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

const NativeChrome = registerPlugin<{ setBackground(o: { color: string }): Promise<void> }>(
  'NativeChrome',
)

/**
 * Paint the native layers behind the page (the window, the web view) in the
 * theme's canvas, so a keyboard transition or an over-scroll never reveals
 * black. Takes a CSS colour; anything that is not #rgb/#rrggbb is ignored
 * rather than guessed at.
 */
export async function setNativeBackground(css: string) {
  if (!isNative()) return
  let hex = css.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(hex)) hex = '#' + [...hex.slice(1)].map((c) => c + c).join('')
  if (!/^#[0-9a-f]{6}$/.test(hex)) return
  try {
    await NativeChrome.setBackground({ color: hex })
  } catch {
    /* an older binary without the plugin: keeps its launch colour */
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
 * The keyboard.
 *
 * The web view is NOT resized for the keyboard (Keyboard.resize = 'none', and
 * MainViewController no longer touches the frame). WebKit shrinks the VISUAL
 * viewport as the keyboard slides in, and `trackViewport` below turns that
 * into the page's height, so layout follows the keyboard from one source.
 *
 * `setScroll` off: WKWebView would otherwise scroll itself to reveal a focused
 * field. The page is already sized to what is visible, so there is nothing to
 * reveal, and that scroll is a second mechanism moving the same pixels.
 *
 * The accessory bar (the ‹ › ✓ strip between the composer and the keys) is
 * WKWebView's form assistant, not ours. It is OFF: it sat between the
 * composer and the keyboard, which is exactly where Instagram has nothing,
 * and ‹ › walk the page's other fields, which is meaningless in a chat. The
 * keyboard is dismissed the iOS way instead: by scrolling the conversation or
 * tapping outside the field.
 */
function setUpKeyboard() {
  void Keyboard.setScroll({ isDisabled: true }).catch(() => {})
  void Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {})
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
/** A URL bar or a pinch is not a keyboard; below this it is not counted. */
const KEYBOARD_FLOOR = 80

/**
 * The visible area, as CSS variables (see index.css for what each means).
 *
 * WHY THIS AND NOT A NATIVE RESIZE. Builds up to 12 resized the whole
 * WKWebView frame by frame from Swift. WebKit relays out its content
 * asynchronously after a frame change, so the page always trailed the native
 * frame by a frame or more: the composer jumped, and a band showed between it
 * and the keyboard. With the web view left alone, WebKit shrinks the visual
 * viewport in step with the keyboard itself, and reading that is one source of
 * truth with no second system to fall out of sync with.
 *
 * rAF-coalesced: iOS fires `resize` and `scroll` together, many times per
 * keyboard animation, and one write per frame is all layout can use. Only
 * the three variables are written, on <html>, so the page reflows through CSS
 * rather than through React re-renders.
 *
 * Called once for the life of the app, so there is nothing to clean up.
 */
function trackViewport() {
  const root = document.documentElement
  const vv = window.visualViewport
  let frame = 0
  let kbOpen = false

  const write = () => {
    frame = 0
    const height = vv ? vv.height : window.innerHeight
    const top = vv ? Math.max(0, vv.offsetTop) : 0
    const covered = Math.max(0, window.innerHeight - (height + top))
    const keyboard = covered > KEYBOARD_FLOOR ? covered : 0
    root.style.setProperty('--ct-app-h', `${Math.round(height)}px`)
    root.style.setProperty('--ct-app-top', `${Math.round(top)}px`)
    root.style.setProperty('--ct-kb', `${Math.round(keyboard)}px`)
    const open = keyboard > 0
    if (open !== kbOpen) {
      kbOpen = open
      root.classList.toggle('ct-kb-open', open)
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(write)
  }

  write()
  window.addEventListener('resize', schedule)
  vv?.addEventListener('resize', schedule)
  vv?.addEventListener('scroll', schedule)
}

export function initNative() {
  if (!isNative()) return
  trackViewport()
  routeApiToSite()
  interceptExternalLinks()
  handleAppBack()
  setUpKeyboard()
  handleUniversalLinks()
  listenForPushTaps()
  listenForReminderTaps(requestNavigate)
}
