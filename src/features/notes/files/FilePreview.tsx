import { useEffect, useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { fileUrl, isImageFile, isPdfFile, type NoteFile } from './files-api'
import { fileKind } from './file-kind'

/**
 * The file itself, at whatever size its container gives it. A PDF uses the
 * browser's own viewer (search, zoom and page thumbnails for free); a picture is
 * shown; anything else (Word, slides) offers to open or download it, because
 * previewing those would mean handing the file to a third-party viewer.
 *
 * The link is signed for ten minutes and asked for again when the file changes,
 * so a copied URL stops working soon after.
 */
export function FilePreview({ file }: { file: NoteFile }) {
  const [state, setState] = useState<{ key: string; url: string | null } | null>(null)

  useEffect(() => {
    let alive = true
    void fileUrl(file).then((url) => alive && setState({ key: file.key, url }))
    return () => {
      alive = false
    }
  }, [file])

  const url = state?.key === file.key ? state.url : undefined
  if (url === undefined) return <div className="ct-shimmer h-full w-full" />
  if (url === null) {
    return <p className="p-6 text-[13.5px] text-muted">This file could not be opened. It may have been deleted.</p>
  }
  if (isPdfFile(file)) {
    return <iframe title={file.name} src={url} className="h-full w-full border-0 bg-white" />
  }
  if (isImageFile(file)) {
    return (
      <div className="grid h-full w-full place-items-center overflow-auto p-4">
        <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
    )
  }
  const kind = fileKind(file)
  const Icon = kind.icon
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon size={42} strokeWidth={1.5} style={{ color: kind.tint }} aria-hidden />
      <p className="max-w-xs text-[13.5px] text-muted">
        {kind.label} files open in the app made for them. Download it, or open it in a new tab.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => window.open(url, '_blank', 'noopener')}>
          <ExternalLink size={14} aria-hidden />
          Open
        </Button>
        <DownloadButton file={file} />
      </div>
    </div>
  )
}

/** Downloads with the file's own name rather than its random storage name. */
export function DownloadButton({ file, compact = false }: { file: NoteFile; compact?: boolean }) {
  const go = async () => {
    const url = await fileUrl(file, file.name)
    if (url) window.location.assign(url)
  }
  return compact ? (
    <button type="button" onClick={() => void go()} aria-label="Download"
      className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg">
      <Download size={16} aria-hidden />
    </button>
  ) : (
    <Button size="sm" variant="outline" onClick={() => void go()}>
      <Download size={14} aria-hidden />
      Download
    </Button>
  )
}
