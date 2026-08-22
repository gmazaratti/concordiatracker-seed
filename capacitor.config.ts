import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The native shell.
 *
 * The web assets are BUNDLED (`webDir: 'dist'`) rather than pointed at the live
 * site. A wrapper that only loads a URL is what App Review guideline 4.2 exists
 * to reject, and an app that shows a blank screen on a train is worse than one
 * that works. The trade is that a web change needs a new binary unless we later
 * add an over-the-air update channel — which Apple permits for interpreted code
 * that does not change the app's purpose (3.3.2), and which is the right thing
 * to add once submissions are routine rather than novel.
 *
 * `appId` is the bundle identifier and is effectively permanent: it is the
 * primary key for the app in App Store Connect, in provisioning profiles, and
 * in every push certificate. Changing it later means a new app listing.
 */
const config: CapacitorConfig = {
  appId: 'com.concordiatracker.app',
  appName: 'ConcordiaTracker',
  webDir: 'dist',

  ios: {
    // Matches the web background, so the gap between the splash screen and the
    // first paint is not a white flash on a dark app.
    backgroundColor: '#0f0f16',
    // The web layer already handles safe areas via env(safe-area-inset-*) in
    // all three layouts, so the native view should go edge to edge and let it.
    contentInset: 'never',
    // Rubber-band scrolling on the WHOLE web view fights the app's own scroll
    // regions — the sidebar is deliberately locked and `main` is the only
    // scroller. Individual elements still bounce.
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },

  server: {
    // Links to our own domain open in the app; anything else is handed to
    // Safari. Without this, an external link would navigate the app itself out
    // of the app with no way back.
    allowNavigation: ['concordiatracker.com', 'www.concordiatracker.com'],
  },

  plugins: {
    SplashScreen: {
      // Hidden by the app once React has mounted, rather than on a timer. A
      // fixed duration is either too short (white flash) or too long (the app
      // feels slow) and is never right on both an old phone and a new one.
      launchAutoHide: false,
      backgroundColor: '#0f0f16',
      showSpinner: false,
    },
    StatusBar: {
      // Light glyphs on our dark canvas. Re-applied at runtime when the theme
      // changes, since a light theme needs the opposite.
      style: 'DARK',
      backgroundColor: '#0f0f16',
      overlaysWebView: true,
    },
  },
}

export default config
