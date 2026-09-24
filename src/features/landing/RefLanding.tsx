import { useLayoutEffect } from 'react'
import { LandingPage } from './LandingPage'
import { setRefSource } from '@/lib/ref-source'
import { useNoIndex } from '@/app/hooks/useNoIndex'

/**
 * A source-attributed copy of the homepage: concordiatracker.com/r (Reddit).
 *
 * THE SAME PAGE, NOT A VARIANT. It renders the real LandingPage inside the same
 * PublicLayout, so there is nothing to keep in sync. The URL stays /r (no
 * redirect, no query string); the only differences are invisible:
 *   - a first-party cookie marks the visit (see lib/ref-source), which analytics
 *     and the signup profile then carry;
 *   - noindex while mounted. The canonical already points at `/`, because
 *     LandingPage declares its own path, so search engines see one page.
 *
 * useLayoutEffect, not useEffect: it runs before every passive effect in the
 * commit, including RouteAnalytics' page view, so even the first view of /r is
 * attributed.
 */
export function RefLanding({ source }: { source: string }) {
  useLayoutEffect(() => {
    setRefSource(source)
  }, [source])
  useNoIndex()
  return <LandingPage />
}
