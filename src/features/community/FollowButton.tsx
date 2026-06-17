import { Check, UserPlus } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { cn } from '@/lib/cn'

/** Follow / Following toggle — reads the (stubbed, swappable) follow store via
 * `useFollows`. Used on the org profile and the event-detail host card. */
export function FollowButton({
  handle,
  size = 'md',
  className,
}: {
  handle: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const { isFollowing, toggleFollow } = useFollows()
  const following = isFollowing(handle)

  return (
    <button
      type="button"
      onClick={() => toggleFollow(handle)}
      aria-pressed={following}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150',
        size === 'sm' ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[13px]',
        following
          ? 'border border-border bg-surface text-muted hover:text-fg'
          : 'bg-accent text-accent-contrast hover:bg-accent-hover',
        className,
      )}
    >
      {following ? <Check size={14} aria-hidden /> : <UserPlus size={14} aria-hidden />}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
