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
// `updateViaCache: 'none'` so the SW script itself is always revalidated against
// the network, which keeps the kill-switch / version bumps fast to propagate.
// Skipped inside the native shell: the assets are already on the device, and a
// service worker caching a capacitor:// origin only adds a second, staler cache
// in front of them.
if (import.meta.env.PROD && !isNative() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Whether this page was already controlled at load. If so, a controller change
    // means a NEW version activated → reload once to run it (so a left-open tab /
    // installed PWA auto-updates instead of getting stuck on an old bundle). A
    // first-ever install (no prior controller) must NOT trigger a reload.
    const hadController = !!navigator.serviceWorker.controller
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return
      reloading = true
      window.location.reload()
    })
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
  })
}
