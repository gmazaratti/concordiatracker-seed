import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { listSchedules, type SavedSchedule } from '@/lib/schedules'
import { listMessages, markRead, type Message } from '@/lib/social'
import { setOpenThread } from '@/lib/message-toast'
import { usePendingWrites } from '@/lib/offline-fetch'
import { localUser } from '@/lib/local-user'

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
        localUser(),
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

  /*
   * MESSAGES SENT OFFLINE. They are in the write queue (lib/offline-fetch),
   * not in the thread the server returns, so they are merged in here and
   * marked pending — the row reads "Sending…" until the queue delivers it.
   * When it does, the thread re-reads and the server's copy (same id, chosen
   * on this device) replaces it.
   */
  const queued = usePendingWrites()
  useEffect(() => {
    const again = () => setTick((n) => n + 1)
    window.addEventListener('ct:offline-synced', again)
    return () => window.removeEventListener('ct:offline-synced', again)
  }, [])
  const merged = useMemo(() => {
    if (!rows) return rows
    const have = new Set(rows.map((r) => r.id))
    const extra: Message[] = []
    for (const q of queued) {
      if (q.table !== 'messages' || q.op !== 'insert') continue
      for (const r of q.rows) {
        if (r.recipient !== other || (me && r.sender !== me) || have.has(String(r.id))) continue
        extra.push({
          id: String(r.id),
          sender: String(r.sender),
          recipient: String(r.recipient),
          body: String(r.body ?? ''),
          attachment: (r.attachment as Message['attachment']) ?? null,
          created_at: String(r.created_at ?? q.at),
          read_at: null,
          reply_to: (r.reply_to as string | undefined) ?? null,
          pending: true,
        })
      }
    }
    return extra.length ? [...rows, ...extra] : rows
  }, [rows, queued, other, me])

  return { rows: merged, schedules, me, theyType, reload, announceTyping }
}
