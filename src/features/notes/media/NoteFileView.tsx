import { useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Download, ExternalLink, FileSpreadsheet, FileText, Mic, Presentation, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fileSize, noteFileUrl } from './note-files'

const ICONS = { audio: Mic, slides: Presentation, sheet: FileSpreadsheet, doc: FileText }
function iconKey(mime: string): keyof typeof ICONS {
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.includes('presentation')) return 'slides'
  if (mime.includes('sheet') || mime === 'text/csv') return 'sheet'
  return 'doc'
}

/** A file as a card you can open or download; a voice note as a player. */
export function FileView({ node, deleteNode, selected, editor }: NodeViewProps) {
  const path = node.attrs.path as string | null
  const name = String(node.attrs.name || 'File')
  const mime = String(node.attrs.mime || '')
  const audio = mime.startsWith('audio/')
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const Icon = ICONS[iconKey(mime)]

  useEffect(() => {
    let cancelled = false
    if (!path) return
    void noteFileUrl(path).then((u) => {
      if (cancelled) return
      if (u) setUrl(u)
      else setFailed(true)
    })
    return () => { cancelled = true }
  }, [path])

  const download = async () => {
    if (!path) return
    const u = await noteFileUrl(path, name)
    if (u) window.location.assign(u)
  }
  const dur = Number(node.attrs.durationMs) || 0

  return (
    <NodeViewWrapper className="my-3" data-drag-handle>
      <div contentEditable={false}
        className={cn('ct-tips flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5', selected && 'outline-2 outline-offset-2 outline-accent')}>
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', audio ? 'bg-accent-soft text-accent' : 'bg-surface text-muted')}>
          <Icon size={18} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[13.5px] font-medium text-fg">{audio ? 'Voice note' : name}</span>
          {audio && url ? (
            <audio controls preload="metadata" src={url} className="h-8 w-full max-w-sm" />
          ) : (
            <span className="text-[12px] text-subtle">
              {failed ? 'This file could not be loaded' : `${fileSize(Number(node.attrs.size) || 0)}${audio && dur ? ` · ${Math.round(dur / 1000)}s` : ''}`}
            </span>
          )}
        </span>
        {!audio && url && (
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg">
            <ExternalLink size={15} aria-hidden />
          </a>
        )}
        <button type="button" aria-label="Download" onClick={() => void download()} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg">
          <Download size={15} aria-hidden />
        </button>
        {editor.isEditable && (
          <button type="button" aria-label="Remove" onClick={() => deleteNode()} className="grid size-8 place-items-center rounded-md text-subtle hover:bg-danger/10 hover:text-danger">
            <Trash2 size={15} aria-hidden />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  )
}
