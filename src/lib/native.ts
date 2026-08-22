import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

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

/** Everything above, in the order it should happen. Called from main.tsx. */
export function initNative() {
  if (!isNative()) return
  interceptExternalLinks()
  handleAppBack()
}
