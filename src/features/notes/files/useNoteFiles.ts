import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { reportWriteError } from '@/lib/write-errors'
import * as api from './files-api'
import type { NoteFile } from './files-api'

/**
 * Every file the Notes screens show, in one module-level store: the folder
 * page, the note's "Link a file" picker and the side panel all read the same
 * list, so uploading in one place shows up in the others without a reload.
 */
interface State {
  files: NoteFile[]
  loaded: boolean
  uploading: number
}
let state: State = { files: [], loaded: false, uploading: 0 }
let inflight: Promise<void> | null = null
let loadedAt = 0
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

function load(force = false) {
  if (inflight || (state.loaded && !force)) return inflight
  inflight = api
    .listFiles()
    .then((files) => {
      loadedAt = Date.now()
      set({ files, loaded: true })
    })
    .catch(() => set({ loaded: true }))
    .finally(() => {
      inflight = null
    })
  return inflight
}

// One account's files must never paint for the next account on this device.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') set({ files: [], loaded: false })
})

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => state

export function useNoteFiles() {
  const s = useSyncExternalStore(subscribe, snapshot)
  // Re-read when a screen opens and the list is over 30s old: a syllabus kept
  // from the Courses tab since then should be here without a reload.
  useEffect(() => {
    void load(Date.now() - loadedAt > 30_000)
  }, [])

  /** Uploads one by one and returns what was added (failures report themselves). */
  const upload = useCallback(async (folderId: string | null, files: File[]): Promise<NoteFile[]> => {
    const added: NoteFile[] = []
    for (const f of files) {
      set({ uploading: state.uploading + 1 })
      const r = await api.uploadFile(folderId, f)
      set({ uploading: state.uploading - 1 })
      if (r.ok) {
        added.push(r.file)
        set({ files: [r.file, ...state.files] })
      } else reportWriteError('The file was not added', r.error)
    }
    return added
  }, [])

  const rename = useCallback(async (f: NoteFile, name: string) => {
    const before = state.files
    set({ files: state.files.map((x) => (x.key === f.key ? { ...x, name: name.trim() || x.name } : x)) })
    if (!(await api.renameFile(f, name))) {
      set({ files: before })
      reportWriteError('The file was not renamed', 'You can only rename files you added.')
    }
  }, [])

  const move = useCallback(async (f: NoteFile, folderId: string | null) => {
    const before = state.files
    set({ files: state.files.map((x) => (x.key === f.key ? { ...x, folderId } : x)) })
    if (!(await api.moveFile(f, folderId))) {
      set({ files: before })
      reportWriteError('The file was not moved', 'Try again.')
    }
  }, [])

  const remove = useCallback(async (f: NoteFile) => {
    const before = state.files
    set({ files: state.files.filter((x) => x.key !== f.key) })
    if (!(await api.deleteFile(f))) {
      set({ files: before })
      reportWriteError('The file was not deleted', 'You can only delete files you added.')
    }
  }, [])

  return { ...s, upload, rename, move, remove, refresh: () => void load(true) }
}
