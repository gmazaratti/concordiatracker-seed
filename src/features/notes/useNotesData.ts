import { useCallback, useEffect, useState } from 'react'
import * as api from './notes-api'
import type { NoteFolder, NoteMeta, NoteTemplate } from './types'
import { BUILT_IN_TEMPLATES } from './templates'

/**
 * The notes list, folders and templates for the Notes page.
 *
 * Kept in a module-level cache as well as state, so leaving Notes and coming
 * back paints the list at once and refreshes behind it instead of flashing
 * empty. Every change is applied here first (optimistic) and then written;
 * a write that fails reports itself through write-errors and the next refresh
 * puts the list back to the truth.
 */
interface Cache {
  notes: NoteMeta[]
  folders: NoteFolder[]
  templates: NoteTemplate[]
}
let cache: Cache | null = null

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
    Promise.all([api.listNotes(), api.listFolders(), api.listTemplates().catch(() => [])])
      .then(([notes, folders, custom]) => {
        if (cancelled) return
        const next = { notes, folders, templates: [...BUILT_IN_TEMPLATES, ...custom] }
        cache = next
        setState(next)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Your notes could not be loaded.')
      })
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

  /** Apply to the list immediately; the editor persists content itself. */
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

  const restore = useCallback(
    async (id: string) => {
      const ok = await api.restoreNote(id)
      refresh()
      return ok
    },
    [refresh],
  )

  const addFolder = useCallback(
    async (name: string) => {
      const f = await api.createFolder(name)
      if (f) commit((c) => ({ ...c, folders: [...c.folders, f] }))
      return f
    },
    [commit],
  )

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      commit((c) => ({ ...c, folders: c.folders.map((f) => (f.id === id ? { ...f, name } : f)) }))
      return api.renameFolder(id, name)
    },
    [commit],
  )

  const removeFolder = useCallback(
    async (id: string) => {
      commit((c) => ({
        ...c,
        folders: c.folders.filter((f) => f.id !== id),
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
    notes: state?.notes ?? [],
    folders: state?.folders ?? [],
    templates: state?.templates ?? BUILT_IN_TEMPLATES,
    refresh,
    createNote,
    patchLocal,
    patchNote,
    trash,
    restore,
    addFolder,
    renameFolder,
    removeFolder,
    addTemplate,
    removeTemplate,
  }
}

export type NotesData = ReturnType<typeof useNotesData>
