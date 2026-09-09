import { useEffect, useState } from 'react'
import { Check, Clock, MessageSquare, Rss, UserPlus, UserX } from 'lucide-react'
import {
  acceptFriend,
  followUser,
  isFollowing,
  listFriends,
  removeFriend,
  requestFriend,
  unfollowUser,
  type Friend,
} from '@/lib/social'
import { cn } from '@/lib/cn'

/**
 * Follow, connect, or walk away.
 *
 * TWO relationships, deliberately, the way LinkedIn splits them:
 *
 *   Follow  — one-way, instant, grants nothing. An interest.
 *   Connect — two-way, has to be accepted, and is the only thing that unlocks
 *             anything: messages, and a schedule if they chose to share it.
 *
 * Keeping them apart is what stops Connect becoming the button people press on
 * strangers to get at a timetable. Follow is the low-stakes action, and having
 * it is what lets the high-stakes one stay meaningful.
 *
 * The connect half has four states, because "we are not connected", "I asked
 * them", "they asked me" and "we are connected" need different words and
 * different actions; collapsing them into one Follow-shaped button is how
 * someone ends up unable to find the request waiting for them.
 *
 * Declining and disconnecting are the same deletion on purpose: a declined
 * request left in a table is a record of a rejection nobody needs.
 */
export function FriendButton({
  handle,
  onChanged,
  onMessage,
}: {
  handle: string
  onChanged?: () => void
  /** Given only when there is somewhere to open a conversation. */
  onMessage?: (friend: Friend) => void
}) {
  const [friend, setFriend] = useState<Friend | null | undefined>(undefined)
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    void listFriends().then((rows) => {
      if (!alive) return
      setFriend(rows.find((f) => f.handle.toLowerCase() === handle.toLowerCase()) ?? null)
    })
    void isFollowing(handle).then((v) => alive && setFollowing(v))
    return () => {
      alive = false
    }
  }, [handle, tick])

  const refresh = () => {
    setTick((n) => n + 1)
    onChanged?.()
  }

  // Undefined means "still asking". Rendering "Add friend" during that flashes
  // the wrong state at someone who already is one.
  if (friend === undefined) {
    return <span className="inline-block h-8 w-28 rounded-lg bg-surface-2" aria-hidden />
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    await fn()
    setBusy(false)
    refresh()
  }

  /** Always offered, whatever the connection state — it is independent of it. */
  const follow = (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        void (async () => {
          setBusy(true)
          const ok = following ? await unfollowUser(handle) : await followUser(handle)
          setBusy(false)
          if (ok) setFollowing(!following)
        })()
      }
      aria-pressed={following}
      title={
        following
          ? 'You see what they post publicly. Click to stop.'
          : 'See what they post publicly. They are not notified and it gives you nothing else.'
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors duration-150 disabled:opacity-50',
        following
          ? 'border-accent bg-accent-soft font-medium text-accent'
          : 'border-border text-muted hover:border-accent hover:text-fg',
      )}
    >
      <Rss size={13} aria-hidden />
      {following ? 'Following' : 'Follow'}
    </button>
  )

  if (friend?.status === 'accepted') {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {onMessage && (
          <button
            type="button"
            onClick={() => onMessage(friend)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            <MessageSquare size={13} aria-hidden />
            Message
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => removeFriend(friend.friendship_id))}
          title="Remove this friend"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-danger hover:text-danger disabled:opacity-50"
        >
          <UserX size={13} aria-hidden />
          Connected
        </button>
        {follow}
      </span>
    )
  }

  if (friend?.status === 'pending' && friend.direction === 'incoming') {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => acceptFriend(friend.friendship_id))}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
        >
          <Check size={13} aria-hidden />
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => removeFriend(friend.friendship_id))}
          className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:text-fg disabled:opacity-50"
        >
          Decline
        </button>
        {follow}
      </span>
    )
  }

  if (friend?.status === 'pending') {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => removeFriend(friend.friendship_id))}
          title="Cancel this request"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:text-fg disabled:opacity-50"
        >
          <Clock size={13} aria-hidden />
          Requested
        </button>
        {follow}
      </span>
    )
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void (async () => {
              setBusy(true)
              const msg = await requestFriend(handle)
              setBusy(false)
              setError(msg)
              if (!msg) refresh()
            })()
          }
          title="Ask to connect. Once they accept you can message them, and see their schedule if they share it."
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover',
            busy && 'opacity-50',
          )}
        >
          <UserPlus size={13} aria-hidden />
          Connect
        </button>
        {follow}
      </span>
      {error && <span className="text-[11px] text-warning">{error}</span>}
    </span>
  )
}
