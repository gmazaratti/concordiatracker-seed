import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth'
import { isNative } from '@/lib/native'
import { onNavigateRequest } from '@/lib/native-nav'
import { refreshNativePushToken } from '@/lib/native-push'

/**
 * The App Store app's link into the router. Renders nothing; a no-op in a
 * browser.
 *
 * Universal links, notification taps and same-site links are queued outside
 * React (lib/native-nav) because they can arrive before it mounts. This takes
 * them from the queue and navigates, and once someone is signed in it
 * re-registers the phone's push token, which iOS can change after a restore
 * or an OS update without telling anyone.
 */
export function NativeBridge() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!isNative()) return
    return onNavigateRequest((path) => navigate(path))
  }, [navigate])

  useEffect(() => {
    if (!isNative() || !user) return
    void refreshNativePushToken()
  }, [user])

  return null
}
