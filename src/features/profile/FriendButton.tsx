import { useEffect, useState } from 'react'
import { Check, Clock, MessageSquare, UserPlus, UserX } from 'lucide-react'
import {
  acceptFriend,
  listFriends,
  removeFriend,
  requestFriend,
  type Friend,
} from '@/lib/social'
import { cn } from '@/lib/cn'

/**
 * Add, accept, or walk away — one control with four states.
 *
 * Four, because "we are not connected", "I asked them", "they asked me" and "we
 * are friends" all need different words and different actions, and collapsing
 * them into one "Follow"-shaped button is how you end up with people unable to
 * find the request that is waiting for them.
 *
 * Declining and unfriending are the same deletion on purpose: a declined
 * request that lingers in a table is a record of a rejection nobody needs.
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    void listFriends().then((rows) => {
      if (!alive) return
      setFriend(rows.find((f) => f.handle.toLowerCase() === handle.toLowerCase()) ?? null)
    })
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

  if (friend?.status === 'accepted') {
    return (
      <span className="flex items-center gap-1.5">
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
          Friends
        </button>
      </span>
    )
  }

  if (friend?.status === 'pending' && friend.direction === 'incoming') {
    return (
      <span className="flex items-center gap-1.5">
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
      </span>
    )
  }

  if (friend?.status === 'pending') {
    return (
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
    )
  }

  return (
    <span className="flex flex-col items-end gap-1">
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
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover',
          busy && 'opacity-50',
        )}
      >
        <UserPlus size={13} aria-hidden />
        Add friend
      </button>
      {error && <span className="text-[11px] text-warning">{error}</span>}
    </span>
  )
}
