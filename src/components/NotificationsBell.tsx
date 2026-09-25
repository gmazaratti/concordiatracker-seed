import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useActivityBadge } from '@/app/usePeopleBadge'
import { activityHref } from '@/features/community/sections'
import { cn } from '@/lib/cn'

/**
 * The bell, in one place.
 *
 * It existed three times — sidebar footer, profile bar, avatar menu — with
 * three copies of the destination, and the destination was the bug: a constant
 * `/app/community?activity=1` replaces the whole query string, so pressing it
 * inside Community threw away `?c=` and dropped you on the Feed. On your own
 * profile that meant the bell navigated you off your own profile, which is
 * what was reported.
 *
 * THE RING IS A 520ms WOBBLE ON THE ICON, not on the button. A button that
 * scales under a finger makes the row around it look like it moved; a bell
 * that rocks reads as the bell doing something. It is keyed so a second press
 * replays it — an animation that only ever plays once is worse than none,
 * because the second press feels dead.
 */
export function NotificationsBell({
  variant = 'sidebar',
}: {
  /** `sidebar` is the small muted one in the footer; `profile` is the larger
   *  one in the profile bar, beside the account menu. */
  variant?: 'sidebar' | 'profile'
}) {
  const count = useActivityBadge()
  const location = useLocation()
  const [ring, setRing] = useState(0)

  return (
    <Link
      to={activityHref(location.pathname, location.search)}
      onClick={() => setRing((n) => n + 1)}
      aria-label={count > 0 ? `Notifications, ${count} new` : 'Notifications'}
      title="Notifications"
      className={cn(
        'relative grid shrink-0 place-items-center transition-colors duration-150',
        variant === 'sidebar'
          ? 'size-8 rounded-lg text-subtle hover:bg-surface-2 hover:text-fg'
          : 'size-9 rounded-full text-fg hover:bg-surface-2',
      )}
    >
      <Bell key={ring} size={variant === 'sidebar' ? 17 : 19} className={ring ? 'ct-bell-ring' : undefined} aria-hidden />
      {count > 0 && (
        <span
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger ring-2 ring-canvas"
          aria-hidden
        />
      )}
    </Link>
  )
}
