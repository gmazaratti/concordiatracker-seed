import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import type { NoteFile } from './files-api'
import { DownloadButton, FilePreview } from './FilePreview'
import { fileKind } from './file-kind'

/** A file opened from a folder: the whole window, with its name, a download and a close. */
export function FileViewer({ file, onClose }: { file: NoteFile; onClose: () => void }) {
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const kind = fileKind(file)
  const Icon = kind.icon
  useEffect(() => {
    const prev = document.title
    document.title = `${file.name} - ConcordiaTracker`
    return () => {
      document.title = prev
    }
  }, [file.name])

  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={file.name} tabIndex={-1}
      onKeyDown={(e) => {
        if (!e.defaultPrevented) onKeyDown(e)
      }}
      className="ct-animate-fade fixed inset-0 z-[90] flex flex-col bg-canvas">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Icon size={17} style={{ color: kind.tint }} className="shrink-0" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">{file.name}</h2>
        <DownloadButton file={file} compact />
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg">
          <X size={17} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <FilePreview file={file} />
      </div>
    </div>,
    document.body,
  )
}
