import { useEffect, useState } from 'react'
import type { NoteProvider } from './NoteProvider'
import type { LivePerson } from '../NoteTopBar'

/**
 * Who has this note open right now, from the live session's awareness (the
 * same channel that carries everyone's cursor). One entry per person even
 * with two tabs open.
 */
export function useLivePeople(provider: NoteProvider | null): LivePerson[] {
  const [people, setPeople] = useState<LivePerson[]>([])
  useEffect(() => {
    if (!provider) return
    const read = () => {
      const seen = new Map<string, LivePerson>()
      provider.awareness.getStates().forEach((state) => {
        const u = (state as { user?: Partial<LivePerson> }).user
        if (u?.uid && !seen.has(u.uid)) {
          seen.set(u.uid, { uid: u.uid, name: u.name ?? 'Someone', color: u.color ?? '#888', avatar: u.avatar ?? null })
        }
      })
      setPeople([...seen.values()])
    }
    read()
    provider.awareness.on('change', read)
    return () => provider.awareness.off('change', read)
  }, [provider])
  return people
}
