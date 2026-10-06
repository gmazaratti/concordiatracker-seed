import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { updateNote } from './notes-api'

export type SaveState = 'saved' | 'pending' | 'saving' | 'error'

interface Pending {
  title?: string
  content?: JSONContent
  bodyText?: string
}

/**
 * Debounced saving for one note.
 *
 * Changes are merged into one pending patch and written 700 ms after the last
 * keystroke — fast enough that closing the laptop rarely loses anything, slow
 * enough that typing a sentence is one write, not forty. The newest patch
 * always wins: a save that comes back after a newer keystroke does not mark
 * the note "saved".
 *
 * Unmounting (switching notes, leaving the page) FLUSHES rather than drops, and
 * so does the tab being hidden — the moment a laptop lid closes or a phone
 * locks is exactly when an unsaved sentence would be lost.
 */
export function useAutosave(noteId: string, onSaved?: (p: Pending) => void) {
  const [state, setState] = useState<SaveState>('saved')
  const pending = useRef<Pending | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generation = useRef(0)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const patch = pending.current
    if (!patch) return
    pending.current = null
    const gen = ++generation.current
    setState('saving')
    const ok = await updateNote(noteId, patch)
    if (gen !== generation.current) return
    if (pending.current) {
      setState('pending')
      return
    }
    setState(ok ? 'saved' : 'error')
    if (ok) onSavedRef.current?.(patch)
  }, [noteId])

  const queue = useCallback(
    (patch: Pending) => {
      pending.current = { ...(pending.current ?? {}), ...patch }
      setState('pending')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), 700)
    },
    [flush],
  )

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      void flush()
    }
  }, [flush])

  return { state, queue, flush }
}
