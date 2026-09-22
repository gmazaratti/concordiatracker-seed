import { useState } from 'react'
import { Check } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { cn } from '@/lib/cn'

/**
 * Follow, on a post header.
 *
 * DELIBERATELY NOT `FollowButton`. That one is a persistent toggle on a
 * profile, where "Following" is a status you go and check. Here it is a
 * one-way action in a scroll: once you follow a club, every later post from
 * them should carry NO button at all — a feed full of "Following" pills is
 * a feed telling you things you already did.
 *
 * SO IT RENDERS NOTHING WHEN YOU ALREADY FOLLOW — except on the card you
 * just tapped, where it stays long enough to show the change and then goes.
 * Confirming an action and then removing the control is the whole
 * interaction; vanishing on the tap would leave you unsure it registered.
 */
export function PostFollowButton({ handle }: { handle: string }) {
  const { isFollowing, toggleFollow } = useFollows()
  const following = isFollowing(handle)
  /** Set only by a tap on THIS card, so this card keeps showing the result
   *  while every other card simply stops rendering the button. */
  const [justFollowed, setJustFollowed] = useState(false)

  if (following && !justFollowed) return null

  return (
    <button
      type="button"
      onClick={() => {
        if (following) return
        setJustFollowed(true)
        toggleFollow(handle)
      }}
      disabled={following}
      aria-label={following ? `Following ${handle}` : `Follow ${handle}`}
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-lg px-3 text-[12.5px] font-semibold',
        // Height and width are animated, so the label swap does not jolt the
        // row it sits in.
        'h-7 transition-[width,background-color,color] duration-300 ease-out',
        following
          ? 'w-[92px] bg-surface-2 text-muted'
          : 'w-[70px] bg-accent text-accent-contrast hover:bg-accent-hover',
      )}
    >
      {/*
        BOTH LABELS ARE ALWAYS MOUNTED, stacked, and cross-fade. Swapping the
        text node instead would snap from one word to the other on the frame
        the state flips, which is the jump this is here to avoid.
      */}
      <span
        className={cn(
          'absolute transition-[opacity,transform] duration-200',
          following ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100',
        )}
      >
        Follow
      </span>
      <span
        className={cn(
          'absolute inline-flex items-center gap-1 transition-[opacity,transform] duration-300',
          following ? 'translate-y-0 opacity-100 delay-100' : '-translate-y-2 opacity-0',
        )}
      >
        <Check size={13} strokeWidth={3} aria-hidden />
        Following
      </span>
    </button>
  )
}
