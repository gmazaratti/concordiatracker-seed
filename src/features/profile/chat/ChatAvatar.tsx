import { useState } from 'react'
import { CachedImg } from '@/components/ui/CachedImg'
import { initialsOf } from '@/lib/initials'
import type { Friend } from '@/lib/social'

export function Avatar({ friend, size = 32 }: { friend: Friend; size?: number }) {
  /*
   * A dead avatar URL used to hide the element, which left a hole the row's
   * layout had already reserved. Falling back to the initials tile — the same
   * one every other surface uses — fills it, and `CachedImg` means a face this
   * session has already seen is painted on the first frame instead of fading
   * in again on every remount of the list.
   */
  const [broken, setBroken] = useState(false)
  if (friend.avatar_url && !broken) {
    return (
      <CachedImg
        src={friend.avatar_url}
        eager
        onFailed={() => setBroken(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-muted"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initialsOf(friend.name, friend.handle)}
    </span>
  )
}
