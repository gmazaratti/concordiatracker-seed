import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Undo2,
  X,
} from 'lucide-react'
import {
  IDENTITY_VIEW,
  IMAGE_SPECS,
  MAX_ZOOM,
  type CropKind,
  type CropView,
  type Size,
  normalizeView,
  outputSize,
  transformSteps,
  turn,
  zoomAbout,
} from '@/lib/image-crop'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { Button } from './Button'
import { cn } from '@/lib/cn'

/**
 * Place an image inside the shape it will actually be shown in.
 *
 * WHY THIS EXISTS AT ALL. Before it, an upload went straight to `object-cover`,
 * which centre-crops — so a logo with the wordmark down one side lost the
 * wordmark and nobody was ever asked. The only way to fix it was to go and edit
 * the file somewhere else and upload it again.
 *
 * IT OPENS THE MOMENT A FILE IS CHOSEN, before the preview, because placement
 * is part of choosing. Seeing the wrong crop in a preview and then hunting for
 * an edit button is two steps where there is one decision.
 *
 * WHERE IT DIFFERS FROM THE DESKTOP EDITORS IT IS MODELLED ON: the frame is the
 * REAL shape (a circle for an avatar, a 4:1 strip for a banner), not a generic
 * rectangle with the aspect typed into a box — so what you line up is what gets
 * published. You drag the picture rather than a selection rectangle, which is
 * the gesture everyone already has from every map and photo app. And the image
 * can never be pulled off its own frame (see `image-crop.ts`), so there is no
 * way to produce a banner with a transparent stripe down one edge.
 */
export function ImageCropper({
  file,
  kind,
  onCancel,
  onDone,
  busy = false,
}: {
  /** The file just chosen — or an existing URL being re-cropped. */
  file: File | string
  kind: CropKind
  onCancel: () => void
  /** Hands back a re-drawn file at the exported size; the caller uploads it. */
  onDone: (file: File) => void
  busy?: boolean
}) {
  const spec = IMAGE_SPECS[kind]
  const { ref: dialogRef, onKeyDown: dismissKeys } = useModalDismiss<HTMLDivElement>(onCancel)

  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [err, setErr] = useState('')
  const [rawView, setRawView] = useState<CropView>(IDENTITY_VIEW)
  const [frame, setFrame] = useState<Size>({ w: 320, h: 320 / spec.aspect })
  const [guides, setGuides] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  const src: Size = useMemo(
    () => ({ w: img?.naturalWidth ?? 0, h: img?.naturalHeight ?? 0 }),
    [img],
  )

  /* Decode. A URL needs CORS to reach a canvas later, and our own bucket sends
     it — but a hot-linked image from somewhere else will not, so that case is
     refused with a sentence rather than failing at export with a tainted
     canvas, which produces a security error nobody can act on. */
  useEffect(() => {
    let dead = false
    const el = new Image()
    if (typeof file === 'string') el.crossOrigin = 'anonymous'
    const url = typeof file === 'string' ? file : URL.createObjectURL(file)
    el.onload = () => {
      if (dead) return
      setImg(el)
    }
    el.onerror = () => {
      if (dead) return
      setErr(
        typeof file === 'string'
          ? 'That image is hosted somewhere that will not let us edit it. Upload the file instead.'
          : 'Could not read that image.',
      )
    }
    el.src = url
    return () => {
      dead = true
      if (typeof file !== 'string') URL.revokeObjectURL(url)
    }
  }, [file])

  /* The stage sizes itself to the dialog, so the frame is as large as the
     screen allows rather than a fixed box with dead space around it. */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const box = el.getBoundingClientRect()
      const pad = 24
      const w = Math.max(160, box.width - pad * 2)
      const h = Math.max(120, box.height - pad * 2)
      const byWidth = { w, h: w / spec.aspect }
      setFrame(byWidth.h <= h ? byWidth : { w: h * spec.aspect, h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [spec.aspect])

  /* THE VIEW IS NORMALISED DURING RENDER, not corrected afterwards by an
     effect. The frame resizes with the window and the image arrives a moment
     after the dialog does, so the stored offset is regularly illegal for a
     frame — clamping it in an effect means a render happens with the bad
     value first, and it is a setState-in-effect besides. `normalizeView` is
     idempotent (asserted in the tests), so running it every render is free. */
  const view = src.w ? normalizeView(src, frame, rawView) : rawView

  const set = useCallback((next: CropView) => setRawView(next), [])

  /* ── Dragging ───────────────────────────────────────────────────────────
     Pointer events with capture, so a drag that leaves the frame keeps
     tracking — and 1:1 with the finger, which is the whole reason this reads
     as moving a photo rather than operating a control. */
  const dragRef = useRef<{ id: number; x: number; y: number; from: CropView } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (!img) return
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: view }
    setGuides(true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* a pointer the browser has already forgotten */
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    e.preventDefault()
    set({ ...d.from, x: d.from.x + (e.clientX - d.x), y: d.from.y + (e.clientY - d.y) })
  }
  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current?.id !== e.pointerId) return
    dragRef.current = null
    setGuides(false)
  }

  /* Wheel zooms about the cursor. Non-passive so it can be prevented — inside
     a modal there is nothing behind to scroll, so taking the wheel costs
     nothing and not taking it means the page moves under the crop. */
  useEffect(() => {
    const el = stageRef.current
    if (!el || !img) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const box = el.getBoundingClientRect()
      const px = e.clientX - (box.left + box.width / 2)
      const py = e.clientY - (box.top + box.height / 2)
      const factor = Math.exp(-e.deltaY / 400)
      setRawView((v) => {
        const now = normalizeView(src, frame, v)
        return zoomAbout(src, frame, now, now.zoom * factor, px, py)
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [img, src, frame])

  // Keyboard: nudge and zoom, so this is not a mouse-only control. Escape and
  // the Tab trap come first — a crop dialog that swallows Escape is a trap.
  const onKeyDown = (e: React.KeyboardEvent) => {
    dismissKeys(e)
    if (e.defaultPrevented) return
    const step = e.shiftKey ? 16 : 4
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const m = moves[e.key]
    if (m) {
      e.preventDefault()
      set({ ...view, x: view.x + m[0], y: view.y + m[1] })
      return
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      set({ ...view, zoom: view.zoom + 0.1 })
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      set({ ...view, zoom: view.zoom - 0.1 })
    }
  }

  /* ── Export ─────────────────────────────────────────────────────────────
     The SAME chain the preview applies, scaled by the ratio between the
     output and the on-screen frame. Written as one multiplication rather than
     as a source rectangle, because a source rectangle has to re-derive the
     rotation and the flips and that is where the two renderers drift apart. */
  async function save() {
    if (!img) return
    const out = outputSize(kind)
    const canvas = document.createElement('canvas')
    canvas.width = out.w
    canvas.height = out.h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setErr('Could not process the image on this device.')
      return
    }
    const k = out.w / frame.w
    const t = transformSteps(src, frame, view)
    ctx.imageSmoothingQuality = 'high'
    ctx.translate(out.w / 2, out.h / 2)
    ctx.scale(k, k)
    ctx.translate(t.translate.x, t.translate.y)
    ctx.rotate((t.rotate * Math.PI) / 180)
    ctx.scale(t.scale.x, t.scale.y)
    ctx.drawImage(img, -src.w / 2, -src.h / 2)

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/webp', 0.92),
    )
    if (!blob) {
      setErr('Could not process the image.')
      return
    }
    onDone(new File([blob], `${kind}.webp`, { type: 'image/webp' }))
  }

  const t = img ? transformSteps(src, frame, view) : null
  const zoomPct = Math.round(view.zoom * 100)

  return createPortal(
    <div className="ct-animate-fade fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Position your ${kind === 'logo' ? 'logo' : 'banner'}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="ct-sheet-in flex max-h-full w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface outline-none sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-fg">
              Position your {kind === 'logo' ? 'logo' : 'banner'}
            </h2>
            <p className="truncate text-[11.5px] text-subtle">
              Drag to move · scroll or pinch to zoom · this is the real shape
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={17} aria-hidden />
          </button>
        </header>

        {/* Stage */}
        <div
          ref={stageRef}
          className="relative flex min-h-[220px] flex-1 items-center justify-center overflow-hidden bg-canvas p-6 select-none sm:min-h-[300px]"
          style={{ touchAction: 'none' }}
        >
          {err ? (
            <p className="max-w-xs text-center text-[13px] text-danger">{err}</p>
          ) : !img ? (
            <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
          ) : (
            <div
              className="relative cursor-grab overflow-hidden active:cursor-grabbing"
              style={{
                width: frame.w,
                height: frame.h,
                borderRadius: kind === 'logo' ? '9999px' : 12,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="absolute top-1/2 left-1/2 max-w-none origin-center"
                style={{
                  width: src.w,
                  height: src.h,
                  transform: `translate(-50%, -50%) translate(${t!.translate.x}px, ${t!.translate.y}px) rotate(${t!.rotate}deg) scale(${t!.scale.x}, ${t!.scale.y})`,
                }}
              />
              {/* Rule-of-thirds, only while you are moving something. A grid
                  that is always on is decoration on top of the thing being
                  judged. */}
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 transition-opacity duration-150',
                  guides ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              >
                {[33.333, 66.666].map((p) => (
                  <span
                    key={`v${p}`}
                    className="absolute top-0 bottom-0 w-px bg-white/35"
                    style={{ left: `${p}%` }}
                  />
                ))}
                {[33.333, 66.666].map((p) => (
                  <span
                    key={`h${p}`}
                    className="absolute right-0 left-0 h-px bg-white/35"
                    style={{ top: `${p}%` }}
                  />
                ))}
              </div>
              <span
                className="pointer-events-none absolute inset-0 ring-1 ring-white/25"
                style={{ borderRadius: kind === 'logo' ? '9999px' : 12 }}
                aria-hidden
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={!img}
              onClick={() => set({ ...view, zoom: view.zoom - 0.15 })}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
            >
              <Minus size={15} aria-hidden />
            </button>
            <input
              type="range"
              className="ct-range min-w-0 flex-1"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              disabled={!img}
              aria-label="Zoom"
              onChange={(e) => set({ ...view, zoom: Number(e.target.value) })}
              onPointerDown={() => setGuides(true)}
              onPointerUp={() => setGuides(false)}
            />
            <button
              type="button"
              aria-label="Zoom in"
              disabled={!img}
              onClick={() => set({ ...view, zoom: view.zoom + 0.15 })}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
            >
              <Plus size={15} aria-hidden />
            </button>
            <span className="w-11 shrink-0 text-right text-[12px] text-subtle tabular-nums">
              {zoomPct}%
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Tool
              label="Rotate left"
              icon={RotateCcw}
              disabled={!img}
              onClick={() => set({ ...view, rotation: turn(view.rotation, -1) })}
            />
            <Tool
              label="Rotate right"
              icon={RotateCw}
              disabled={!img}
              onClick={() => set({ ...view, rotation: turn(view.rotation, 1) })}
            />
            <Tool
              label="Flip horizontally"
              icon={FlipHorizontal2}
              disabled={!img}
              on={view.flipX}
              onClick={() => set({ ...view, flipX: !view.flipX })}
            />
            <Tool
              label="Flip vertically"
              icon={FlipVertical2}
              disabled={!img}
              on={view.flipY}
              onClick={() => set({ ...view, flipY: !view.flipY })}
            />
            <Tool
              label="Reset"
              icon={Undo2}
              disabled={!img}
              onClick={() => set(IDENTITY_VIEW)}
            />
            <span className="ml-auto text-[11px] text-subtle">
              Saves at {IMAGE_SPECS[kind].recommended}
            </span>
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtle transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <Button className="ml-auto" onClick={save} disabled={!img || busy}>
            {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {busy ? 'Saving…' : 'Use this'}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function Tool({
  label,
  icon: Icon,
  onClick,
  disabled,
  on,
}: {
  label: string
  icon: typeof RotateCw
  onClick: () => void
  disabled?: boolean
  on?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-lg border transition-colors duration-150 disabled:opacity-40',
        on
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon size={15} aria-hidden />
    </button>
  )
}
