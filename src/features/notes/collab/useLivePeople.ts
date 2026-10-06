import { useEffect, useState } from 'react'
import type { NoteProvider } from './NoteProvider'
import type { LivePerson } from '../NoteTopBar'

/**
 * Who has this note open right now, from the live session's awareness (the
 * same channel that carries everyone's cursor). One entry per person even
 * with two tabs open.
 *
 *   active  the note is the tab they are looking at
 *   idle    the note is open, but in a background tab or an unfocused window
 *   (absent) they closed it: awareness drops them within about 30 seconds
 */
export function useLivePeople(provider: NoteProvider | null): LivePerson[] {
  const [people, setPeople] = useState<LivePerson[]>([])
  useEffect(() => {
    if (!provider) return
    const read = () => {
      const seen = new Map<string, LivePerson>()
      provider.awareness.getStates().forEach((state) => {
        const u = (state as { user?: Partial<LivePerson> }).user
        if (!u?.uid) return
        // Several tabs of one person count once, and as active if any of them is.
        const active = (state as { status?: string }).status !== 'idle'
        const prev = seen.get(u.uid)
        if (prev) {
          if (active) prev.status = 'active'
          return
        }
        seen.set(u.uid, { uid: u.uid, name: u.name ?? 'Someone', color: u.color ?? '#888', avatar: u.avatar ?? null, status: active ? 'active' : 'idle' })
      })
      setPeople([...seen.values()])
    }
    read()
    provider.awareness.on('change', read)
    return () => provider.awareness.off('change', read)
  }, [provider])
  return people
}

/**
 * Tell the room who I am and whether I am looking at the note right now.
 * Re-sent when my name or id arrives (the editor can start before my profile
 * has loaded) and whenever the tab gains or loses focus.
 */
export function useAnnounceMe(provider: NoteProvider | null, me: { uid: string; name: string; color: string; avatar: string | null }) {
  useEffect(() => {
    if (!provider) return
    const aw = provider.awareness
    aw.setLocalStateField('user', me)
    const update = () => aw.setLocalStateField('status', document.visibilityState === 'visible' && document.hasFocus() ? 'active' : 'idle')
    update()
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [provider, me])
}
