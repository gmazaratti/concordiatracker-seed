import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth'
import { clearReturn, peekReturn } from '@/lib/auth-intent'

/**
 * Sends somebody back to the page that asked them to sign in.
 *
 * Mounted once inside the router. It acts only when a session exists AND a
 * return path was recorded (see lib/auth-intent), and only if they are not
 * already on it. Renders nothing.
 */
export function AuthIntentRedirect() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    const to = peekReturn()
    if (!to) return
    if (to === pathname) clearReturn()
    else navigate(to, { replace: true })
  }, [user, pathname, navigate])

  return null
}
