import { formatSize, type NoteFile } from './files-api'
import { fileKind } from './file-kind'

/** A file in a folder: the same footprint as a note card, so the two sit in one grid. */
export function FileCard({ file, onOpen, onContextMenu }: {
  file: NoteFile
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const kind = fileKind(file)
  const Icon = kind.icon
  const date = new Date(file.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
  return (
    <button type="button" onClick={onOpen} onContextMenu={onContextMenu}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent">
      <div className="grid flex-1 place-items-center" style={{ background: `${kind.tint}14` }}>
        <Icon size={38} strokeWidth={1.6} style={{ color: kind.tint }} aria-hidden />
      </div>
      <div className="min-w-0 border-t border-border px-3 py-2.5">
        <p className="truncate text-[13.5px] font-medium text-fg" title={file.name}>{file.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-subtle">
          {file.source === 'course' && (
            <span className="rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent">Syllabus</span>
          )}
          <span>{kind.label}</span>
          {file.sizeBytes != null && <span>· {formatSize(file.sizeBytes)}</span>}
          <span>· {date}</span>
        </p>
      </div>
    </button>
  )
}
