import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { listSchedules, type SavedSchedule } from '@/lib/schedules'
import { listMessages, markRead, type Message } from '@/lib/social'
import { setOpenThread } from '@/lib/message-toast'

/**
 * One conversation's data: its messages, whether they are typing, and the
 * saved schedules the + sheet offers.
 *
 * `reload()` re-reads the thread; `announceTyping()` tells them you are
 * typing. Both live here because both ride the same channel.
 */
export function useChatThread(other: string) {
  const [rows, setRows] = useState<Message[] | null>(null)
  const [schedules, setSchedules] = useState<SavedSchedule[]>([])
  const [me, setMe] = useState<string | null>(null)
  const [theyType, setTheyType] = useState(false)
  const [tick, setTick] = useState(0)
  const typingSentAt = useRef(0)

  /**
   * While this conversation is on screen, its messages do not raise the
   * in-app banner. A banner for a message you are watching arrive is noise,
   * and it covers the top of the thread you are reading.
   */
  useEffect(() => {
    setOpenThread(other)
    return () => setOpenThread(null)
  }, [other])

  useEffect(() => {
    let alive = true
    void (async () => {
      const [msgs, saved, auth] = await Promise.all([
        listMessages(other),
        listSchedules(),
        supabase.auth.getUser(),
      ])
      if (!alive) return
      setRows(msgs)
      setSchedules(saved)
      setMe(auth.data.user?.id ?? null)
      void markRead(other)
    })()
    return () => {
      alive = false
    }
  }, [other, tick])

  /**
   * New messages, and whether they are typing.
   *
   * Postgres changes give us the message; a broadcast gives us the typing,
   * because "someone is typing" is worth nothing a second later and has no
   * business being a row in a table. The channel name is the ORDERED pair, so
   * both sides land in the same room without either having to be the host.
   */
  useEffect(() => {
    if (!me) return
    const pair = [me, other].sort().join('_')
    let clear: ReturnType<typeof setTimeout> | undefined

    const channel = supabase
      .channel(`chat_${pair}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if ((payload as { from?: string })?.from !== other) return
        setTheyType(true)
        clearTimeout(clear)
        // Self-clearing: a "stopped typing" event that never arrives (a closed
        // tab, a dropped connection) would leave the bubble up forever.
        clear = setTimeout(() => setTheyType(false), 4000)
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as Message
          const mine = row.sender === me && row.recipient === other
          const theirs = row.sender === other && row.recipient === me
          if (!mine && !theirs) return
          setTheyType(false)
          setTick((n) => n + 1)
        },
      )
      .subscribe()

    return () => {
      clearTimeout(clear)
      void supabase.removeChannel(channel)
    }
  }, [me, other])

  function announceTyping() {
    if (!me) return
    // Throttled: one ping every two seconds is enough to hold a bubble open,
    // and a broadcast per keystroke is a lot of traffic for a dot animation.
    const now = Date.now()
    if (now - typingSentAt.current < 2000) return
    typingSentAt.current = now
    const pair = [me, other].sort().join('_')
    void supabase.channel(`chat_${pair}`).send({ type: 'broadcast', event: 'typing', payload: { from: me } })
  }
  const reload = () => setTick((n) => n + 1)

  return { rows, schedules, me, theyType, reload, announceTyping }
}
