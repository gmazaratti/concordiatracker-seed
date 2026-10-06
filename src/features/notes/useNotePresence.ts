import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface PresentPerson {
  uid: string
  name: string
  avatar: string | null
  canEdit: boolean
  joined: number
  key: string
}

/**
 * Who has this note open right now, and who holds the pen.
 *
 * Live co-editing (several people typing in one document, merged) is a later
 * phase. Until then two editors typing at once would overwrite each other, so
 * the first editor to open the note holds the pen and everyone else reads,
 * with their copy refreshed on every save the holder makes. When the holder
 * leaves, the next editor gets the pen. Nothing is ever silently lost.
 *
 * Offline, or before the channel connects, you can always type: the save goes
 * through the normal path and the newest write wins, as it did before.
 */
export function useNotePresence({
  noteId,
  me,
  canEdit,
  onRemoteSave,
}: {
  noteId: string
  me: { uid: string; name: string; avatar: string | null } | null
  canEdit: boolean
  onRemoteSave: () => void
}) {
  const [people, setPeople] = useState<PresentPerson[]>([])
  const [connected, setConnected] = useState(false)
  const key = useMemo(() => crypto.randomUUID(), [])
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const remote = useRef(onRemoteSave)
  useEffect(() => {
    remote.current = onRemoteSave
  }, [onRemoteSave])

  useEffect(() => {
    if (!me) return
    const joined = Date.now()
    const ch = supabase.channel(`note:${noteId}`, { config: { presence: { key } } })
    channel.current = ch
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<Omit<PresentPerson, 'key'>>()
      const list: PresentPerson[] = []
      for (const [k, metas] of Object.entries(state)) {
        const m = metas[0]
        if (m) list.push({ uid: m.uid, name: m.name, avatar: m.avatar, canEdit: m.canEdit, joined: m.joined, key: k })
      }
      setPeople(list)
    })
    ch.on('broadcast', { event: 'saved' }, ({ payload }) => {
      if ((payload as { key?: string }).key !== key) remote.current()
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true)
        void ch.track({ uid: me.uid, name: me.name, avatar: me.avatar, canEdit, joined })
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnected(false)
      }
    })
    return () => {
      channel.current = null
      void supabase.removeChannel(ch)
    }
  }, [noteId, me, canEdit, key])

  const holder = useMemo(
    () => people.filter((p) => p.canEdit).sort((a, b) => a.joined - b.joined || a.key.localeCompare(b.key))[0] ?? null,
    [people],
  )
  const canType = canEdit && (!connected || !holder || holder.key === key)

  // One face per person, even with two tabs open.
  const unique = useMemo(() => {
    const seen = new Map<string, PresentPerson>()
    for (const p of people) if (!seen.has(p.uid)) seen.set(p.uid, p)
    return [...seen.values()]
  }, [people])

  const announceSave = () => {
    void channel.current?.send({ type: 'broadcast', event: 'saved', payload: { key } })
  }

  return { present: unique, holder: holder && holder.key !== key ? holder : null, canType, announceSave }
}
