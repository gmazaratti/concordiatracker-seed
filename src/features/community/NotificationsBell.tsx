import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { startOfToday } from '@/lib/date'
import { useCommunity } from './useCommunity'

/**
 * A link to the Notifications page, with the unread dot.
 *
 * Same reasoning as Following: a list of things that each open something else
 * does not belong in a panel that closes when you look away. The dot stays
 * here, because the whole point of it is being visible from the feed.
 *
 * "Unread" is anything posted today or later, which is honest for a mocked
 * feed and needs no stored read state that a backend would only replace.
 */
export function NotificationsBell() {
  const { followedHandles } = useFollows()
  const { recentEventsFromOrgs } = useCommunity()
  const unread = recentEventsFromOrgs(followedHandles, startOfToday()).length > 0

  return (
    <Link
      to="/app/community/notifications"
      aria-label={`Notifications${unread ? ' (unread)' : ''}`}
      className="relative grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      <Bell size={17} aria-hidden />
      {unread && (
        <span
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-surface"
          aria-hidden
        />
      )}
    </Link>
  )
}
