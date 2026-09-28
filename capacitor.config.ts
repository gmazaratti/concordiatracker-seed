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
 *
 * THE LAUNCH COLOUR IS FIXED, AND IT IS THE DEFAULT DARK CANVAS (#0f0f16).
 * iOS draws the launch screen before a single line of our code runs, so it
 * cannot follow the theme a student picked. The three candidates were the dark
 * canvas, the light canvas, and a mid grey that belongs to neither. Mid grey
 * flashes for EVERYONE; either canvas flashes only for people on the other
 * one. Dark wins because it is the theme every new account starts on and the
 * background of the app icon, so the launch reads as the icon opening rather
 * than as a colour. The same value is used for the web view's own background
 * and the splash, so there is exactly one colour between tap and first paint.
 */
const LAUNCH_BACKGROUND = '#0f0f16'

const config: CapacitorConfig = {
  appId: 'com.concordiatracker.app',
  appName: 'ConcordiaTracker',
  webDir: 'dist',

  ios: {
    backgroundColor: LAUNCH_BACKGROUND,
    // The web layer already handles safe areas via env(safe-area-inset-*) in
    // all three layouts, so the native view should go edge to edge and let it.
    contentInset: 'never',
    scrollEnabled: true,
    // Only our own domains may be NAVIGATED to inside the web view (fetches to
    // the API are not navigations and are unaffected). Requires the matching
    // WKAppBoundDomains list in ios/App/App/Info.plist. Sign-in no longer
    // navigates the web view at all: it runs in the system browser sheet
    // (see native-auth.ts), which is exactly why this can stay strict.
    limitsNavigationsToAppBoundDomains: true,
    // Taps on a link and hold on text behave like the rest of iOS.
    allowsLinkPreview: false,
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
      backgroundColor: LAUNCH_BACKGROUND,
      showSpinner: false,
    },
    StatusBar: {
      // Light glyphs on our dark canvas. Re-applied at runtime when the theme
      // changes, since a light theme needs the opposite.
      style: 'DARK',
      backgroundColor: LAUNCH_BACKGROUND,
      overlaysWebView: true,
    },
    Keyboard: {
      // The web view shrinks when the keyboard opens, so `100dvh`, the chat
      // composer and every bottom sheet sit above it with no JavaScript. The
      // alternative ('none') leaves the page under the keyboard and relies on
      // the visual-viewport maths the web build needs for Safari; the native
      // shell does not have to guess.
      resize: 'native',
      resizeOnFullScreen: true,
      style: 'DEFAULT',
    },
    PushNotifications: {
      // A push that arrives while the app is open still shows its banner: a
      // seat opening or a deadline reminder is exactly as urgent then.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
