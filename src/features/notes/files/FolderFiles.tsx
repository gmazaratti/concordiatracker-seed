import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, ExternalLink, Pencil, Trash2, Upload } from 'lucide-react'
import { ContextMenu } from '@/components/ui/ContextMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { FILE_ACCEPT, fileUrl, type NoteFile } from './files-api'
import { useNoteFiles } from './useNoteFiles'
import { FileCard } from './FileCard'
import { FileViewer } from './FileViewer'

/**
 * The files in a folder, under its notes' folders. In a class folder that
 * includes the syllabus kept when the course was created, read from where it
 * already lives. Drop files anywhere on the page to add them here.
 */
export function FolderFiles({ folderId, courseId, myId, folderName }: {
  /** null = General. */
  folderId: string | null
  courseId: string | null
  myId: string | null
  folderName: string
}) {
  const store = useNoteFiles()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState<NoteFile | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; file: NoteFile } | null>(null)
  const [renaming, setRenaming] = useState<NoteFile | null>(null)
  const [deleting, setDeleting] = useState<NoteFile | null>(null)
  const [over, setOver] = useState(false)

  const files = useMemo(
    () =>
      store.files.filter((f) =>
        f.source === 'course'
          ? !!courseId && f.courseId === courseId
          : folderId === null
            ? f.folderId === null && f.ownerId === myId
            : f.folderId === folderId,
      ),
    [store.files, folderId, courseId, myId],
  )

  // Files dragged in from the computer, anywhere on the page. Cards dragged
  // between folders carry no files, so they are left to the folder grid.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setOver(true)
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOver(false)
    }
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setOver(false)
      void store.upload(folderId, [...(e.dataTransfer?.files ?? [])])
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overFn)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overFn)
      window.removeEventListener('drop', drop)
    }
  }, [store, folderId])

  const itemsFor = (f: NoteFile): MenuItem[] => {
    const mine = f.ownerId === myId
    return [
      { id: 'open', label: 'Open', icon: ExternalLink, onSelect: () => setOpen(f) },
      {
        id: 'download', label: 'Download', icon: Download,
        onSelect: () => void fileUrl(f, f.name).then((u) => u && window.location.assign(u)),
      },
      ...(mine
        ? [
            { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setRenaming(f) },
            { id: 'delete', label: 'Delete', icon: Trash2, danger: true, separated: true, onSelect: () => setDeleting(f) },
          ]
        : []),
    ]
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[12px] font-semibold tracking-wide text-subtle uppercase">Files</h2>
        {store.uploading > 0 && <span className="text-[12px] text-muted">Uploading {store.uploading}…</span>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => input.current?.click()}>
          <Upload size={14} aria-hidden />
          Upload file
        </Button>
        <input ref={input} type="file" accept={FILE_ACCEPT} multiple hidden
          onChange={(e) => {
            void store.upload(folderId, [...(e.target.files ?? [])])
            e.target.value = ''
          }} />
      </div>

      {files.length === 0 ? (
        <button type="button" onClick={() => input.current?.click()}
          className="w-full rounded-2xl border border-dashed border-border-strong px-4 py-5 text-center text-[13px] text-muted transition-colors hover:border-accent hover:text-fg">
          Drop PDFs, slides or documents here, or press to choose. They open beside your notes.
        </button>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
          {files.map((f) => (
            <div key={f.key} className="h-48">
              <FileCard file={f} onOpen={() => setOpen(f)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ x: e.clientX, y: e.clientY, file: f })
                }} />
            </div>
          ))}
        </div>
      )}

      {over && (
        <div className="pointer-events-none fixed inset-0 z-[85] grid place-items-center bg-canvas/70 backdrop-blur-sm">
          <div className={cn('rounded-2xl border-2 border-dashed border-accent bg-surface px-8 py-6 text-center')}>
            <Upload size={26} className="mx-auto text-accent" aria-hidden />
            <p className="mt-2 text-[15px] font-semibold text-fg">Drop to add to {folderName}</p>
            <p className="text-[12.5px] text-muted">PDF, Word, slides, sheets or pictures, up to 25 MB each</p>
          </div>
        </div>
      )}

      {menu && <ContextMenu x={menu.x} y={menu.y} label={menu.file.name} items={itemsFor(menu.file)} onClose={() => setMenu(null)} />}
      {open && <FileViewer file={open} onClose={() => setOpen(null)} />}
      {renaming && (
        <RenameDialog file={renaming} onClose={() => setRenaming(null)}
          onSave={(name) => {
            void store.rename(renaming, name)
            setRenaming(null)
          }} />
      )}
      {deleting && (
        <ModalShell label="Delete file" onClose={() => setDeleting(null)}>
          <div className="p-5">
            <h2 className="text-[16px] font-semibold text-fg">Delete {deleting.name}?</h2>
            <p className="mt-1.5 text-[13.5px] text-muted">
              {deleting.source === 'course'
                ? 'This is the syllabus kept with the course. It is removed from the course page too. Links to it in your notes will stop opening.'
                : 'Links to it in your notes will stop opening. This cannot be undone.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button size="sm" className="bg-danger text-white hover:bg-danger/90"
                onClick={() => {
                  void store.remove(deleting)
                  setDeleting(null)
                }}>
                Delete
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </section>
  )
}

function RenameDialog({ file, onClose, onSave }: { file: NoteFile; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(file.name)
  return (
    <ModalShell label="Rename file" onClose={onClose}>
      <form className="p-5" onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSave(name)
      }}>
        <h2 className="text-[16px] font-semibold text-fg">Rename file</h2>
        <input autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} aria-label="File name"
          className="mt-3 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[14px] text-fg outline-none focus:border-accent" />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={!name.trim()}>Save</Button>
        </div>
      </form>
    </ModalShell>
  )
}
