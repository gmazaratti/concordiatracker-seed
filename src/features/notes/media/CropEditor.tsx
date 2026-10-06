import { useRef, useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { dragCrop, FULL, type Crop } from './image-geometry'

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move'

/**
 * Cropping in place: the whole picture with the kept part outlined. Drag a
 * corner to resize the box, drag inside it to move it, then Done. Nothing is
 * cut from the file; the note just shows the part you kept, so it can always
 * be uncropped.
 */
export function CropEditor({ src, initial, onDone, onCancel }: {
  src: string
  initial: Crop | null
  onDone: (c: Crop | null) => void
  onCancel: () => void
}) {
  const [crop, setCrop] = useState<Crop>(initial ?? FULL)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Crop } | null>(null)

  const down = (e: React.PointerEvent<HTMLElement>) => {
    const handle = e.currentTarget.dataset.handle as Handle | undefined
    if (!handle) return
    e.preventDefault()
    e.stopPropagation()
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* unknown pointer */ }
    drag.current = { handle, x: e.clientX, y: e.clientY, start: crop }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    const r = box.current?.getBoundingClientRect()
    if (!d || !r || !r.width || !r.height) return
    setCrop(dragCrop(d.start, d.handle, (e.clientX - d.x) / r.width, (e.clientY - d.y) / r.height))
  }
  const up = () => { drag.current = null }

  const pct = (v: number) => `${v * 100}%`
  const corner = (h: Handle, pos: React.CSSProperties) => (
    <span data-handle={h} onPointerDown={down} style={pos} aria-hidden
      className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white bg-accent shadow" />
  )
  const whole = crop.w > 0.999 && crop.h > 0.999

  return (
    <div contentEditable={false} className="relative select-none" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div ref={box} className="relative">
        <img src={src} alt="" draggable={false} className="block w-full rounded-lg" />
        {/* The dimmed parts that will be hidden. */}
        <div className="absolute inset-0 rounded-lg bg-black/55" style={{
          clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pct(crop.x)} ${pct(crop.y)}, ${pct(crop.x)} ${pct(crop.y + crop.h)}, ${pct(crop.x + crop.w)} ${pct(crop.y + crop.h)}, ${pct(crop.x + crop.w)} ${pct(crop.y)}, ${pct(crop.x)} ${pct(crop.y)})`,
        }} />
        <div data-handle="move" onPointerDown={down} className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }} />
        {corner('nw', { left: pct(crop.x), top: pct(crop.y), cursor: 'nwse-resize' })}
        {corner('ne', { left: pct(crop.x + crop.w), top: pct(crop.y), cursor: 'nesw-resize' })}
        {corner('sw', { left: pct(crop.x), top: pct(crop.y + crop.h), cursor: 'nesw-resize' })}
        {corner('se', { left: pct(crop.x + crop.w), top: pct(crop.y + crop.h), cursor: 'nwse-resize' })}
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-lg">
        <button type="button" onClick={() => setCrop(FULL)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted hover:bg-surface-2 hover:text-fg">
          <RotateCcw size={13} aria-hidden /> Reset
        </button>
        <button type="button" onClick={onCancel} aria-label="Cancel cropping" className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">
          <X size={14} aria-hidden />
        </button>
        <button type="button" onClick={() => onDone(whole ? null : crop)} className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[12px] font-medium text-accent-contrast hover:bg-accent-hover">
          <Check size={13} aria-hidden /> Done
        </button>
      </div>
    </div>
  )
}
