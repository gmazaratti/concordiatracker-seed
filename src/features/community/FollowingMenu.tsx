import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'

/**
 * A link to the Following page.
 *
 * It used to open a popover. The list has no ceiling, every row has its own
 * destination and its own unfollow control, and on a phone a 288px panel
 * hanging off a header button gave each of those about forty pixels. A page
 * also gets a URL, so the back button works and the list can be linked to.
 */
export function FollowingMenu() {
  const { followedHandles } = useFollows()
  return (
    <Link
      to="/app/community/following"
      data-tour="following"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      <Users size={16} aria-hidden />
      <span className="hidden sm:inline">Following</span>
      <span className="rounded bg-surface-2 px-1.5 text-[11px] tabular-nums">
        {followedHandles.length}
      </span>
    </Link>
  )
}
