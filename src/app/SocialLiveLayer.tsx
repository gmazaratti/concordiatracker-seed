import { useEffect } from 'react'
import { useAuth } from '@/app/providers/auth'
import { onSocialChange } from '@/lib/social-live'
import { notificationsChanged } from '@/lib/notification-state'

/**
 * One live subscription for follows, schedule shares and new notifications
 * (lib/social-live). Anything new tells the bell and the activity list
 * (`notificationsChanged`) and fires `ct:social-changed` for the views that
 * show follower counts and requests. Renders nothing.
 */
export function SocialLiveLayer() {
  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    return onSocialChange(user.id, () => {
      notificationsChanged()
      window.dispatchEvent(new CustomEvent('ct:social-changed'))
    })
  }, [user])
  return null
}
