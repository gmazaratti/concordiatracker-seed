import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { bumpMessages, buzz, notifyMessage } from '@/lib/message-alerts'

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
          const row = payload.new as { sender?: string; body?: string | null }
          // Your own message echoing back is not news.
          if (row.sender === me) return
          bumpMessages()
          buzz()
          notifyMessage('New message', row.body ?? 'Sent you something', () =>
            navigate('/app/community?c=messages'),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [me, navigate])

  return null
}
