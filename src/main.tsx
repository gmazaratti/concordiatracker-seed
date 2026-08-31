import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/pwa-install' // capture `beforeinstallprompt` as early as possible
import App from './App.tsx'
import { initNative, isNative, nativeReady } from './lib/native'

// No-ops in a browser, so the web build is unchanged.
initNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Dismiss the native splash once React has actually painted, rather than on a
// timer — a fixed duration is too short on a fast phone and too long on a slow
// one. requestAnimationFrame fires after the first frame is committed.
requestAnimationFrame(() => void nativeReady())

// Register the service worker (production builds only — dev keeps live HMR).
//
// Two things have to be true for a deploy to reach an INSTALLED app, and until
// now only one of them was.
//
//   1. sw.js has to CHANGE, or the browser installs nothing. It used to be
//      byte-identical every deploy; `scripts/stamp-sw.mjs` now stamps it with
//      the build's content hash.
//   2. Something has to ASK. `load` fires once, and a PWA the user keeps in the
//      app switcher for a week never fires it again — no navigation, no check,
//      no update, running last week's bundle against this week's database.
//
// So the check is tied to the app becoming visible, which is both the moment it
// matters and the moment a reload costs nothing: the student has just come back
// and has not started typing anything yet.
if (import.meta.env.PROD && !isNative() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Whether this page was already controlled at load. A first-ever install
    // (no prior controller) must NOT trigger a reload.
    const hadController = !!navigator.serviceWorker.controller
    let pending = false
    let lastShown = Date.now()

    const applyNow = () => {
      if (!pending) return
      pending = false
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return
      pending = true
      // Free to reload if nobody is looking. Also free if the update landed
      // within a few seconds of the app being reopened, because that update was
      // triggered BY the reopen and the student has not done anything yet.
      if (document.hidden || Date.now() - lastShown < 8000) applyNow()
      // Otherwise it waits for the next time they leave and come back, rather
      // than pulling the page out from under a half-typed grade.
    })

    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const onVisible = () => {
          if (document.hidden) return
          lastShown = Date.now()
          applyNow() // anything that landed while they were away
          void reg.update().catch(() => {}) // and look for more
        }
        document.addEventListener('visibilitychange', onVisible)
        // A long backstop for a session left open on a desktop, where the tab
        // may stay visible for hours.
        window.setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000)
      })
      .catch(() => {})
  })
}
