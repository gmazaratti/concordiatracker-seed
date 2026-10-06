import { useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { ImageOff, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { noteImageUrl } from './note-media'

const SIZES = [
  { key: 'small', label: 'S', width: '33%' },
  { key: 'medium', label: 'M', width: '55%' },
  { key: 'large', label: 'L', width: '80%' },
  { key: 'full', label: 'Full', width: '100%' },
] as const

/** Shows a stored image by resolving its path to a short-lived link. */
export function ImageView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const path = node.attrs.path as string | null
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!path) return
    void noteImageUrl(path).then((u) => {
      if (cancelled) return
      if (u) setUrl(u)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  const size = SIZES.find((s) => s.key === node.attrs.size) ?? SIZES[3]
  const src = path ? url : (node.attrs.src as string | null)
  return (
    <NodeViewWrapper className="ct-note-image relative my-3" data-drag-handle>
      <div className="relative mx-auto" style={{ width: size.width, maxWidth: '100%' }}>
        {failed ? (
          <div className="flex h-32 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-[13px] text-subtle">
            <ImageOff size={16} aria-hidden /> This image could not be loaded
          </div>
        ) : src ? (
          <img src={src} alt={(node.attrs.alt as string) || ''} draggable={false}
            className={cn('block w-full rounded-lg', selected && 'outline-2 outline-offset-2 outline-accent')} />
        ) : (
          <div className="ct-shimmer rounded-lg" style={{ aspectRatio: `${node.attrs.width || 4} / ${node.attrs.height || 3}` }} />
        )}
        {selected && editor.isEditable && (
          <div contentEditable={false} className="ct-animate-pop absolute top-2 right-2 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-lg">
            {SIZES.map((s) => (
              <button key={s.key} type="button" onClick={() => updateAttributes({ size: s.key })}
                className={cn('rounded-md px-2 py-1 text-[12px] font-medium', s.key === size.key ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                {s.label}
              </button>
            ))}
            <button type="button" aria-label="Remove image" onClick={() => deleteNode()} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-danger/10 hover:text-danger">
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
