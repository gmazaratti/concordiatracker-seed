import { useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import { useNoteFiles } from './useNoteFiles'
import { FilePreview, DownloadButton } from './FilePreview'
import { FileViewer } from './FileViewer'
import { fileKind } from './file-kind'

/**
 * A file opened from a link inside a note, in the side panel next to the page,
 * so you read the slides and write about them in the same view. Someone the
 * note is shared with but the file is not gets told so, rather than a blank box.
 */
export function FilePanel({ fileKey, onClose }: { fileKey: string; onClose: () => void }) {
  const store = useNoteFiles()
  const [full, setFull] = useState(false)
  const file = store.files.find((f) => f.key === fileKey) ?? null

  if (!file) {
    return (
      <div className="flex h-full flex-col">
        <Bar title="File" onClose={onClose} />
        {store.loaded ? (
          <p className="p-5 text-[13.5px] text-muted">
            This file was deleted, or it is in a folder that was not shared with you. Ask the person who wrote the note to share it.
          </p>
        ) : (
          <div className="ct-shimmer m-4 h-40 rounded-xl" />
        )}
      </div>
    )
  }
  const k = fileKind(file)
  const Icon = k.icon
  return (
    <div className="flex h-full flex-col">
      <Bar title={file.name} onClose={onClose} icon={<Icon size={15} style={{ color: k.tint }} className="shrink-0" aria-hidden />}>
        <DownloadButton file={file} compact />
        <button type="button" aria-label="Open full screen" onClick={() => setFull(true)}
          className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg">
          <Maximize2 size={15} aria-hidden />
        </button>
      </Bar>
      <div className="min-h-0 flex-1">
        <FilePreview file={file} />
      </div>
      {full && <FileViewer file={file} onClose={() => setFull(false)} />}
    </div>
  )
}

function Bar({ title, icon, children, onClose }: { title: string; icon?: React.ReactNode; children?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3">
      {icon}
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg" title={title}>{title}</p>
      {children}
      <button type="button" aria-label="Close file" onClick={onClose}
        className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg">
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}
