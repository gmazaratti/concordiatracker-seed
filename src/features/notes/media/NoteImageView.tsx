import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Crop as CropIcon, ImageOff, Square, SquareRoundCorner, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { noteImageUrl } from './note-media'
import { CropEditor } from './CropEditor'
import { readCrop, SIZE_PCT, widthFromDrag, type Crop } from './image-geometry'

const PRESETS = [
  { key: 'small', label: 'S' },
  { key: 'medium', label: 'M' },
  { key: 'large', label: 'L' },
  { key: 'full', label: 'Full' },
] as const

/**
 * An image in a note. Selected (and editable), it can be resized by dragging
 * either bottom corner, cropped in place, given square or rounded corners, or
 * set to one of four sizes. Everything is stored on the node, so it looks the
 * same for everyone, in the PDF, and in an export.
 */
export function ImageView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const path = node.attrs.path as string | null
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [cropping, setCropping] = useState(false)
  const [livePct, setLivePct] = useState<number | null>(null)
  const frame = useRef<HTMLDivElement>(null)

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

  const storedPct = typeof node.attrs.widthPct === 'number' ? (node.attrs.widthPct as number) : (SIZE_PCT[node.attrs.size as string] ?? 100)
  const pct = livePct ?? storedPct
  const rounded = node.attrs.rounded !== false
  const crop = readCrop(node.attrs.crop)
  const src = path ? url : (node.attrs.src as string | null)
  const natW = Number(node.attrs.width) || 4
  const natH = Number(node.attrs.height) || 3
  const editable = editor.isEditable

  const startResize = (side: 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const page = frame.current?.parentElement?.getBoundingClientRect().width ?? 0
    const x0 = e.clientX
    const target = e.currentTarget as HTMLElement
    try { target.setPointerCapture(e.pointerId) } catch { /* unknown pointer */ }
    let last = storedPct
    const move = (ev: PointerEvent) => {
      last = widthFromDrag(storedPct, ev.clientX - x0, page, side)
      setLivePct(last)
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      updateAttributes({ widthPct: last })
      setLivePct(null)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  return (
    <NodeViewWrapper className="ct-note-image relative my-3" data-drag-handle>
      <div ref={frame} className="relative mx-auto" style={{ width: `${pct}%`, maxWidth: '100%' }}>
        {failed ? (
          <div className="flex h-32 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-[13px] text-subtle">
            <ImageOff size={16} aria-hidden /> This image could not be loaded
          </div>
        ) : !src ? (
          <div className="ct-shimmer rounded-lg" style={{ aspectRatio: `${natW} / ${natH}` }} />
        ) : cropping ? (
          <CropEditor src={src} initial={crop} onCancel={() => setCropping(false)}
            onDone={(c) => { updateAttributes({ crop: c }); setCropping(false) }} />
        ) : (
          <Picture src={src} alt={(node.attrs.alt as string) || ''} crop={crop} natW={natW} natH={natH} rounded={rounded}
            className={cn(selected && 'outline-2 outline-offset-2 outline-accent')} />
        )}

        {selected && editable && src && !cropping && (
          <>
            {(['left', 'right'] as const).map((side) => (
              <span key={side} contentEditable={false} onPointerDown={startResize(side)} aria-hidden title="Drag to resize"
                className={cn('absolute bottom-0 size-3.5 translate-y-1/2 rounded-sm border-2 border-white bg-accent shadow',
                  side === 'left' ? 'left-0 -translate-x-1/2 cursor-nesw-resize' : 'right-0 translate-x-1/2 cursor-nwse-resize')} />
            ))}
            <div contentEditable={false} className="ct-tips ct-animate-pop absolute top-2 right-2 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-lg">
              {PRESETS.map((s) => (
                <button key={s.key} type="button" aria-label={`Size: ${s.key}`} onClick={() => updateAttributes({ size: s.key, widthPct: null })}
                  className={cn('rounded-md px-2 py-1 text-[12px] font-medium', SIZE_PCT[s.key] === pct ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                  {s.label}
                </button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
              <button type="button" aria-label="Crop" onClick={() => setCropping(true)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">
                <CropIcon size={14} aria-hidden />
              </button>
              <button type="button" aria-label={rounded ? 'Square corners' : 'Rounded corners'} aria-pressed={rounded}
                onClick={() => updateAttributes({ rounded: !rounded })} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">
                {rounded ? <SquareRoundCorner size={14} aria-hidden /> : <Square size={14} aria-hidden />}
              </button>
              <button type="button" aria-label="Remove image" onClick={() => deleteNode()} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-danger/10 hover:text-danger">
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

/** The picture, showing only its kept part when it has been cropped. */
function Picture({ src, alt, crop, natW, natH, rounded, className }: {
  src: string
  alt: string
  crop: Crop | null
  natW: number
  natH: number
  rounded: boolean
  className?: string
}) {
  const r = rounded ? 'rounded-lg' : 'rounded-none'
  if (!crop) return <img src={src} alt={alt} draggable={false} className={cn('block w-full', r, className)} />
  return (
    <div className={cn('relative w-full overflow-hidden', r, className)} style={{ aspectRatio: `${crop.w * natW} / ${crop.h * natH}` }}>
      <img src={src} alt={alt} draggable={false} className="absolute max-w-none"
        style={{ width: `${100 / crop.w}%`, height: `${100 / crop.h}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%` }} />
    </div>
  )
}
