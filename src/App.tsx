import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { normalizePath, scrubAnalyticsUrl } from './lib/route-shape'
import { AuthProvider } from '@/app/providers/AuthProvider'
import { AppProviders } from '@/app/providers/AppProviders'
import { AppRoutes } from '@/router'
import { RouteAnalytics } from '@/app/RouteAnalytics'
import { AuthIntentRedirect } from '@/app/AuthIntentRedirect'
import { NativeBridge } from '@/app/NativeBridge'
import { ForceUpdateGate } from '@/app/ForceUpdateGate'
import { isNative } from '@/lib/native'

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
          <RouteAnalytics />
          <AuthIntentRedirect />
          <NativeBridge />
          <AppRoutes />
          <ForceUpdateGate />
          {/*
            Vercel's own measurement. Two deliberate conditions:

            PROD ONLY — in dev these would fire on every hot reload and log a
            console warning about a missing endpoint on every page.

            NOT IN THE NATIVE APP — the iOS shell serves the bundle from the
            device, so `/_vercel/insights/*` does not exist there. Both scripts
            would 404 on every launch and report nothing, which is the same
            trap the service-worker registration above already guards against.

            The `/react` entry point, NOT `/next`: Vercel's dashboard assumes
            Next.js and hands you that import. This is a Vite SPA and the Next
            build would not resolve.
          */}
          {import.meta.env.PROD && !isNative() && (
            <>
              {/* beforeSend strips query strings, fragments and token-like path
                  segments (lib/route-shape): a club claim link is a credential,
                  and it must not reach Vercel as a page view. */}
              <Analytics beforeSend={(e) => ({ ...e, url: scrubAnalyticsUrl(e.url) })} />
              <SpeedInsights
                beforeSend={(e) => ({ ...e, url: scrubAnalyticsUrl(e.url), ...(e.route ? { route: normalizePath(e.route) } : {}) })}
              />
            </>
          )}
        </BrowserRouter>
      </AppProviders>
    </AuthProvider>
  )
}
