import { useCallback, useEffect, useState } from 'react'
import { getNote } from './notes-api'
import { notePeople, noteRole, touchNote, type NotePerson } from './sharing-api'
import { opened } from './opened-cache'
import type { Note, NoteRole } from './types'

/**
 * One note, my role on it, and the people on it. The note paints from the
 * in-memory copy at once if it was open before, then the server copy replaces
 * it — unless what is on screen is newer, which only happens after a local edit.
 */
export function useNoteDoc(noteId: string) {
  const [note, setNote] = useState<Note | null>(() => opened.get(noteId) ?? null)
  const [role, setRole] = useState<NoteRole | null>(null)
  const [people, setPeople] = useState<NotePerson[]>([])
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getNote(noteId), noteRole(noteId)])
      .then(([n, r]) => {
        if (cancelled) return
        if (!n || !r) return setMissing(true)
        const local = opened.get(noteId)
        if (!local || local.updatedAt <= n.updatedAt) {
          opened.set(n.id, n)
          setNote(n)
        }
        setRole(r)
        touchNote(noteId)
      })
      .catch(() => {
        if (!cancelled && !opened.get(noteId)) setMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [noteId])

  const loadPeople = useCallback(() => {
    notePeople(noteId).then(setPeople).catch(() => {})
  }, [noteId])

  useEffect(() => {
    loadPeople()
    const t = setInterval(loadPeople, 60_000)
    return () => clearInterval(t)
  }, [loadPeople])

  /** Take the latest server copy (after someone else saved). */
  const reload = useCallback(async () => {
    const n = await getNote(noteId).catch(() => null)
    if (n) {
      opened.set(n.id, n)
      setNote(n)
    }
    return n
  }, [noteId])

  return { note, setNote, role, people, missing, reload, loadPeople }
}
