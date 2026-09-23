import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Message } from '@/lib/social'
import {
  loadReactions,
  reactMessage,
  receiptsState,
  setReceipts,
  threadReceipts,
  type Reaction,
  type ReceiptsState,
} from '@/lib/message-extras'

/**
 * Reactions and read receipts for one conversation.
 *
 * Reacting is OPTIMISTIC — a heart that appears a round trip after the double
 * tap reads as the tap not working — and put back if the server refuses.
 * Receipts come from `thread_receipts`, which returns nothing unless BOTH
 * people have them on, so the screen cannot show a read time the other person
 * switched off even by mistake.
 */
export function useChatExtras(friendId: string, rows: Message[] | null, me: string | null) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [receipts, setState] = useState<ReceiptsState>({ mine: true, shared: false })
  const [readAt, setReadAt] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const idsKey = rows?.map((r) => r.id).join(',') ?? ''

  useEffect(() => {
    if (!idsKey) return
    let alive = true
    void Promise.all([loadReactions(idsKey.split(',')), receiptsState(friendId), threadReceipts(friendId)]).then(
      ([r, s, t]) => {
        if (!alive) return
        setReactions(r)
        setState(s)
        setReadAt(t)
      },
    )
    return () => {
      alive = false
    }
  }, [idsKey, friendId])

  const byMessage = useMemo(() => {
    const map = new Map<string, Reaction[]>()
    for (const r of reactions) map.set(r.messageId, [...(map.get(r.messageId) ?? []), r])
    return map
  }, [reactions])

  const react = useCallback(
    (messageId: string, emoji: string) => {
      if (!me) return
      const before = reactions
      const mineNow = reactions.find((r) => r.messageId === messageId && r.userId === me)
      const rest = reactions.filter((r) => !(r.messageId === messageId && r.userId === me))
      // The same emoji again takes it off, as the server does.
      setReactions(mineNow?.emoji === emoji ? rest : [...rest, { messageId, userId: me, emoji }])
      setError(null)
      void reactMessage(messageId, emoji).catch((e: unknown) => {
        setReactions(before)
        setError(e instanceof Error ? e.message : 'That reaction did not save.')
      })
    },
    [me, reactions],
  )

  const setMine = useCallback(
    (on: boolean) => {
      const was = receipts
      setState({ mine: on, shared: on && was.shared })
      void setReceipts(friendId, on)
        .then(() => Promise.all([receiptsState(friendId), threadReceipts(friendId)]))
        .then(([s, t]) => {
          setState(s)
          setReadAt(t)
        })
        .catch(() => setState(was))
    },
    [friendId, receipts],
  )

  return { byMessage, react, receipts, readAt, setMine, error }
}
