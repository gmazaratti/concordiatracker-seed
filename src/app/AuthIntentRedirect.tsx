import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth'
import { clearReturn, markFollowed, peekReturnEntry } from '@/lib/auth-intent'

/** A follow that a competing redirect beat can be retried for this long. */
const RETRY_MS = 5000

/**
 * Sends somebody back to the page that asked them to sign in.
 *
 * Mounted once inside the router. It acts only when a session exists AND a
 * return path was recorded (see lib/auth-intent), and only if they are not
 * already on it. Renders nothing.
 *
 * ONE TRIP, NOT A LEASH (2026-11-11). It used to redirect on every navigation
 * until the stored path was visited, for up to 30 minutes. A page that re-saved
 * the path while briefly seeing no user (the family page did) turned that into
 * a trap: every visit to /app bounced back to /family and the regular site was
 * unreachable. Now a path is followed once; a few seconds' grace covers the
 * case it exists for (a new account's onboarding redirect racing this one),
 * and after that it is dropped instead of followed again. Arriving on the path,
 * query string or not, also clears it.
 */
export function AuthIntentRedirect() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    const entry = peekReturnEntry()
    if (!entry) return
    const target = entry.path.split(/[?#]/)[0]
    if (target === pathname) return clearReturn()
    if (entry.followedAt && Date.now() - entry.followedAt > RETRY_MS) return clearReturn()
    if (!entry.followedAt) markFollowed()
    navigate(entry.path, { replace: true })
  }, [user, pathname, navigate])

  return null
}
