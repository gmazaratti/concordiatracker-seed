import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { startHeartbeat, trackView } from '@/lib/analytics'

/**
 * Records an anonymous page view on every route change, and runs the heartbeat
 * that powers "online right now". Renders nothing.
 *
 * Must live inside the Router (it reads the location). Everything it sends is
 * anonymous and path-normalized — see lib/analytics.
 */
export function RouteAnalytics() {
  const { pathname } = useLocation()

  useEffect(() => {
    trackView(pathname)
  }, [pathname])

  useEffect(() => startHeartbeat(), [])

  return null
}
