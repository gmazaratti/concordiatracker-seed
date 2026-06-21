import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/pwa-install' // capture `beforeinstallprompt` as early as possible
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker (production builds only — dev keeps live HMR).
// `updateViaCache: 'none'` so the SW script itself is always revalidated against
// the network, which keeps the kill-switch / version bumps fast to propagate.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
  })
}
