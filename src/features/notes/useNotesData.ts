import { useCallback, useEffect, useState } from 'react'
import { localUser } from '@/lib/local-user'
import { supabase } from '@/lib/supabase'
import * as api from './notes-api'
import { sharedWithMe, type SharedItem } from './sharing-api'
import type { NoteFolder, NoteMeta, NoteTemplate } from './types'
import { BUILT_IN_TEMPLATES } from './templates'

/**
 * Everything the Notes screens list: my notes, my folders (classes included),
 * what others shared with me, and templates.
 *
 * Kept in a module-level cache as well as state, so going home → folder →
 * note → back paints instantly and refreshes behind it. Changes apply here
 * first and are written after; a failed write reports itself (write-errors)
 * and the next refresh restores the truth.
 */
interface Cache {
  myId: string
  notes: NoteMeta[]
  folders: NoteFolder[]
  shared: SharedItem[]
  templates: NoteTemplate[]
}
let cache: Cache | null = null

// One account's notes must never paint for the next account on this device.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') cache = null
})

export function useNotesData() {
  const [state, setState] = useState<Cache | null>(cache)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const commit = useCallback((next: (c: Cache) => Cache) => {
    setState((prev) => {
      if (!prev) return prev
      const out = next(prev)
      cache = out
      return out
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await localUser()
        const myId = data.user?.id
        if (!myId) throw new Error('Sign in to see your notes.')
        await api.ensureClassFolders().catch(() => {})
        const [notes, folders, shared, custom] = await Promise.all([
          api.listNotes(),
          api.listFolders(myId),
          sharedWithMe().catch(() => [] as SharedItem[]),
          api.listTemplates().catch(() => [] as NoteTemplate[]),
        ])
        if (cancelled) return
        // listNotes reads everything RLS lets me see; my own list is mine only.
        const next: Cache = { myId, notes, folders, shared, templates: [...BUILT_IN_TEMPLATES, ...custom] }
        cache = next
        setState(next)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Your notes could not be loaded.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const createNote = useCallback(
    async (init: api.NewNote) => {
      const meta = await api.createNote(init)
      commit((c) => ({ ...c, notes: [meta, ...c.notes] }))
      return meta
    },
    [commit],
  )

  const patchLocal = useCallback(
    (id: string, patch: Partial<NoteMeta>) =>
      commit((c) => ({ ...c, notes: c.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
    [commit],
  )

  const patchNote = useCallback(
    async (id: string, patch: api.NotePatch & Partial<NoteMeta>) => {
      patchLocal(id, { ...patch, updatedAt: new Date().toISOString() })
      return api.updateNote(id, patch)
    },
    [patchLocal],
  )

  const trash = useCallback(
    async (id: string) => {
      commit((c) => ({ ...c, notes: c.notes.filter((n) => n.id !== id) }))
      const ok = await api.trashNote(id)
      if (!ok) refresh()
      return ok
    },
    [commit, refresh],
  )

  const addFolder = useCallback(
    async (init: Parameters<typeof api.createFolder>[0]) => {
      const f = await api.createFolder(init)
      if (f) commit((c) => ({ ...c, folders: [...c.folders, f] }))
      return f
    },
    [commit],
  )

  const patchFolder = useCallback(
    async (id: string, patch: api.FolderPatch) => {
      commit((c) => ({ ...c, folders: c.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))
      const ok = await api.updateFolder(id, patch)
      if (!ok) refresh()
      return ok
    },
    [commit, refresh],
  )

  /** Several position changes from one drag, applied together. */
  const reposition = useCallback(
    async (changes: { id: string; position: number }[]) => {
      const byId = new Map(changes.map((c) => [c.id, c.position]))
      commit((c) => ({ ...c, folders: c.folders.map((f) => (byId.has(f.id) ? { ...f, position: byId.get(f.id)! } : f)) }))
      const results = await Promise.all(changes.map((ch) => api.updateFolder(ch.id, { position: ch.position })))
      if (results.some((r) => !r)) refresh()
    },
    [commit, refresh],
  )

  const removeFolder = useCallback(
    async (id: string) => {
      commit((c) => ({
        ...c,
        folders: c.folders.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: null } : f)),
        notes: c.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
      }))
      return api.deleteFolder(id)
    },
    [commit],
  )

  const addTemplate = useCallback(
    async (name: string, content: NoteTemplate['content']) => {
      const t = await api.saveTemplate(name, content)
      if (t) commit((c) => ({ ...c, templates: [...c.templates, t] }))
      return t
    },
    [commit],
  )

  const removeTemplate = useCallback(
    async (id: string) => {
      commit((c) => ({ ...c, templates: c.templates.filter((t) => t.id !== id) }))
      return api.deleteTemplate(id)
    },
    [commit],
  )

  return {
    loading: !state && !error,
    error,
    myId: state?.myId ?? null,
    notes: state?.notes ?? [],
    folders: state?.folders ?? [],
    shared: state?.shared ?? [],
    templates: state?.templates ?? BUILT_IN_TEMPLATES,
    refresh,
    createNote,
    patchLocal,
    patchNote,
    trash,
    addFolder,
    patchFolder,
    reposition,
    removeFolder,
    addTemplate,
    removeTemplate,
  }
}

export type NotesData = ReturnType<typeof useNotesData>
