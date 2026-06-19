import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/app/providers/AuthProvider'
import { AppProviders } from '@/app/providers/AppProviders'
import { AppRoutes } from '@/router'

export default function App() {
  // Capture a vanity referral code (?ref=CODE) once, before it's lost to OAuth
  // redirects — applied to the profile on first sign-in for signup attribution.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      try {
        localStorage.setItem('ct_ref', ref.trim().toUpperCase().slice(0, 20))
      } catch {
        /* localStorage unavailable — ignore */
      }
    }
  }, [])

  return (
    <AuthProvider>
      <AppProviders>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProviders>
    </AuthProvider>
  )
}
