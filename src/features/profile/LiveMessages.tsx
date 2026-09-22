import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { bumpMessages, notifyMessage } from '@/lib/message-alerts'
import { pushMessageAlert } from '@/lib/message-toast'
import { listThreads } from '@/lib/social'

/**
 * One subscription, on the shell, for every message addressed to you.
 *
 * WHY IT IS HERE AND NOT IN THE LIST. A message can arrive while you are on
 * Today, or on your timetable, or anywhere else. Subscribing from the
 * conversation list would only notice the ones that arrive while you are
 * already looking at the conversation list, which is the case that needed it
 * least. `Chat.tsx` keeps its own subscription for the thread you have open
 * — that one is about rendering the bubble, this one is about the rest of
 * the app finding out.
 *
 * REALTIME WAS NEVER ON. `supabase_realtime` existed with no tables in it, so
 * the subscription chat has always had received nothing and a message only
 * appeared after a refetch — which is what switching tabs did. `db/realtime.sql`
 * publishes `messages`; RLS still applies to what is delivered, so this
 * receives the rows the caller could already have queried and no others.
 *
 * THE ROW DOES NOT SAY WHO SENT IT — it carries a user id, and a banner
 * reading "someone" is worth less than no banner. So one `my_threads` call
 * resolves the name, handle and face. It is the same RPC the inbox already
 * uses, it is cheap, and it means the banner and the list cannot disagree
 * about who a message is from. If the lookup fails the banner still appears
 * with what the row gave us and simply opens the inbox instead of the thread.
 */
export function LiveMessages() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const me = user?.id

  useEffect(() => {
    if (!me) return
    const channel = supabase
      .channel(`inbox_${me}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // Server-side, so a busy conversation between two other people
          // never reaches this tab at all.
          filter: `recipient=eq.${me}`,
        },
        (payload) => {
          const row = payload.new as {
            sender?: string
            sender_org?: string | null
            body?: string | null
          }
          // Your own message echoing back is not news.
          if (row.sender === me && !row.sender_org) return
          bumpMessages()

          const body = (row.body ?? '').trim() || 'Sent you something'
          const from = row.sender_org ?? row.sender ?? ''

          void listThreads()
            .then((threads) => {
              const t = threads.find((x) => x.other === from)
              pushMessageAlert({
                otherId: from,
                otherKind: t?.other_kind ?? (row.sender_org ? 'org' : 'user'),
                handle: t?.other_handle ?? null,
                name: t?.other_name ?? t?.other_handle ?? 'New message',
                avatar: t?.other_avatar ?? null,
                body,
              })
              notifyMessage(t?.other_name ?? 'New message', body, () =>
                navigate('/app/community?c=messages'),
              )
            })
            .catch(() => {
              pushMessageAlert({
                otherId: from,
                otherKind: row.sender_org ? 'org' : 'user',
                handle: null,
                name: 'New message',
                avatar: null,
                body,
              })
            })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [me, navigate])

  return null
}
