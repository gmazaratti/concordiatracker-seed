import { useMemo, useState } from 'react'
import { Search, Upload } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { FILE_ACCEPT, type NoteFile } from './files-api'
import { fileKind } from './file-kind'
import { useNoteFiles } from './useNoteFiles'

/** Where a file lives, in words: its folder, its class, or General. */
export type PlaceOf = (f: NoteFile) => string

/**
 * "Link to a file": pick one of your files and the note gets a link to it.
 * Clicking that link later opens the file beside the note. Uploading from here
 * puts the new file in General and links it straight away.
 */
export function FileLinkPicker({ placeOf, onPick, onClose }: {
  placeOf: PlaceOf
  onPick: (f: NoteFile) => void
  onClose: () => void
}) {
  const store = useNoteFiles()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return store.files.filter((f) => !needle || `${f.name} ${placeOf(f)}`.toLowerCase().includes(needle))
  }, [store.files, q, placeOf])

  const uploadAndLink = async (files: File[]) => {
    const [added] = await store.upload(null, files.slice(0, 1))
    if (added) onPick(added)
  }

  return (
    <ModalShell label="Link to a file" onClose={onClose} widthClass="sm:max-w-lg">
      <div className="p-5">
        <h2 className="text-[16px] font-semibold text-fg">Link to a file</h2>
        <p className="mt-1 text-[13px] text-muted">The link opens the file beside this note.</p>
        <label className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-border bg-canvas px-2.5 focus-within:border-accent">
          <Search size={14} className="shrink-0 text-subtle" aria-hidden />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your files" aria-label="Search your files"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-subtle" />
        </label>
        <ul className="mt-3 max-h-80 overflow-y-auto">
          {!store.loaded && <li className="ct-shimmer h-12 rounded-lg" />}
          {store.loaded && list.length === 0 && (
            <li className="px-1 py-6 text-center text-[13px] text-muted">
              {q ? `No files match "${q}".` : 'No files yet. Upload one below, or add files to a folder.'}
            </li>
          )}
          {list.map((f) => {
            const k = fileKind(f)
            const Icon = k.icon
            return (
              <li key={f.key}>
                <button type="button" onClick={() => onPick(f)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2">
                  <Icon size={18} style={{ color: k.tint }} className="shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-fg">{f.name}</span>
                    <span className="block truncate text-[12px] text-subtle">{placeOf(f)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-fg">
          <Upload size={15} aria-hidden />
          {store.uploading > 0 ? 'Uploading…' : 'Upload a file and link it'}
          <input type="file" accept={FILE_ACCEPT} hidden
            onChange={(e) => {
              void uploadAndLink([...(e.target.files ?? [])])
              e.target.value = ''
            }} />
        </label>
      </div>
    </ModalShell>
  )
}
