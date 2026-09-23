import { useRef, useState } from 'react'
import { ArrowRight, Crop, Plus, SlidersHorizontal, Sparkles, Type, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PhotoFrame } from './PhotoFrame'
import { FullPreview } from './FullPreview'
import { AdjustPanel, CropPanel, FilterStrip, TextPanel } from './EditTools'
import type { AspectId, PhotoText } from './photo-edit'
import type { ComposeItem } from './items'

type Tool = 'text' | 'filter' | 'adjust' | 'crop'

/** One slide, and the space either side that lets the first and last centre. */
const SLIDE = 'min(84%, 420px)'
const EDGE = 'calc((100% - min(84%, 420px)) / 2 - 0.75rem)'

/**
 * Screen 2 of 3: make each photo look right.
 *
 * WHAT IS HERE: text, filters, adjustments and the crop — the four things a
 * club actually does to a poster or an event photo before it goes out, and all
 * four are BAKED INTO the uploaded file, so the post looks the same on every
 * screen. WHAT IS NOT: audio and overlays. We have no licence to any music,
 * and a button that cannot do anything is worse than no button.
 *
 * Tap anywhere on the photo to add text there; drag text to move it. In the
 * crop tool, dragging moves the photo inside its frame instead.
 */
export function EditStep({
  items,
  ratio,
  aspect,
  onAspect,
  onChange,
  onBack,
  onAddMore,
  onNext,
}: {
  items: ComposeItem[]
  ratio: number
  aspect: AspectId
  onAspect: (a: AspectId) => void
  onChange: (key: string, patch: Partial<ComposeItem>) => void
  onBack: () => void
  onAddMore: () => void
  onNext: () => void
}) {
  const [index, setIndex] = useState(0)
  const [tool, setTool] = useState<Tool | null>(null)
  const [activeText, setActiveText] = useState<number | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const strip = useRef<HTMLDivElement>(null)
  const current = items[Math.min(index, items.length - 1)]
  const isImage = current?.kind === 'image'

  const addText = (x: number, y: number) => {
    if (!current || !isImage) return
    const t: PhotoText = { text: '', x, y, color: '#ffffff', font: 'modern', chip: false }
    onChange(current.key, { texts: [...current.texts, t] })
    setActiveText(current.texts.length)
    setTool('text')
  }

  const patchText = (i: number, p: Partial<PhotoText>) => {
    if (!current) return
    onChange(current.key, { texts: current.texts.map((t, n) => (n === i ? { ...t, ...p } : t)) })
  }

  const dragText = (e: React.PointerEvent, i: number) => {
    e.stopPropagation()
    const frame = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect()
    if (!frame || !current) return
    setActiveText(i)
    setTool('text')
    const key = current.key
    const texts = current.texts
    capture(e.currentTarget as HTMLElement, e.pointerId)
    const move = (ev: PointerEvent) =>
      onChange(key, {
        texts: texts.map((t, n) =>
          n === i
            ? {
                ...t,
                x: Math.min(1, Math.max(0, (ev.clientX - frame.left) / frame.width)),
                y: Math.min(1, Math.max(0, (ev.clientY - frame.top) / frame.height)),
              }
            : t,
        ),
      })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /** In the crop tool: move the photo inside its frame. */
  const startPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'crop' || !current) return
    const box = e.currentTarget.getBoundingClientRect()
    const imgRatio = current.w / current.h
    const overX = imgRatio > ratio ? box.height * imgRatio - box.width : 0
    const overY = imgRatio > ratio ? 0 : box.width / imgRatio - box.height
    const start = { x: e.clientX, y: e.clientY, panX: current.panX, panY: current.panY }
    const key = current.key
    capture(e.currentTarget, e.pointerId)
    const move = (ev: PointerEvent) => {
      const clamp = (v: number) => Math.min(1, Math.max(0, v))
      onChange(key, {
        panX: overX > 0 ? clamp(start.panX - (ev.clientX - start.x) / overX) : 0.5,
        panY: overY > 0 ? clamp(start.panY - (ev.clientY - start.y) / overY) : 0.5,
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onScroll = () => {
    const el = strip.current
    if (!el) return
    // The slide whose centre is nearest the strip's centre. Dividing
    // scrollLeft by a slide width ignored the gap and the edge spacers, so the
    // counter drifted a photo behind by the end of a long post.
    const mid = el.scrollLeft + el.clientWidth / 2
    const slides = [...el.querySelectorAll<HTMLElement>('[data-slide]')]
    if (!slides.length) return
    let n = 0
    let best = Infinity
    slides.forEach((sl, i) => {
      const d = Math.abs(sl.offsetLeft + sl.offsetWidth / 2 - mid)
      if (d < best) {
        best = d
        n = i
      }
    })
    if (n !== index) {
      setIndex(n)
      setActiveText(null)
    }
  }

  const scrollToSlide = (i: number) => {
    const el = strip.current
    const sl = el?.querySelectorAll<HTMLElement>('[data-slide]')[i]
    if (el && sl) el.scrollTo({ left: sl.offsetLeft + sl.offsetWidth / 2 - el.clientWidth / 2, behavior: 'smooth' })
  }

  if (!current) return null
  const text = activeText != null ? current.texts[activeText] : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to your photos"
          className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg transition-colors hover:bg-surface"
        >
          <X size={20} aria-hidden />
        </button>
        <span className="flex-1 text-center text-[13px] text-subtle">
          {items.length > 1 ? `${index + 1} of ${items.length}` : ''}
        </span>
        <span className="size-10" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div
          ref={strip}
          onScroll={onScroll}
          className={cn(
            // Snap to CENTRE, glide between. The edge spacers are sized from the
            // same min() as the slide, so the first and last photo can sit in
            // the middle too — a percentage padding beside a capped slide
            // centred nothing once the cap applied.
            'flex snap-x snap-mandatory gap-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            tool === 'crop' ? 'overflow-hidden' : 'overflow-x-auto',
          )}
        >
          <div className="shrink-0" style={{ width: EDGE }} aria-hidden />
          {items.map((it, i) => (
            <div
              key={it.key}
              data-slide
              className="shrink-0 snap-center snap-always"
              style={{ width: SLIDE }}
              onPointerDown={i === index ? startPan : undefined}
            >
              <PhotoFrame
                item={it}
                ratio={ratio}
                className={cn(
                  'rounded-2xl transition-opacity duration-200',
                  i !== index && 'opacity-60',
                  tool === 'crop' && i === index && 'cursor-grab ring-2 ring-accent',
                )}
                onTap={
                  tool === 'crop'
                    ? undefined
                    : i !== index
                      ? () => scrollToSlide(i)
                      : tool === 'text'
                        ? addText
                        : () => setViewing(i)
                }
                onTextPointerDown={i === index && tool !== 'crop' ? dragText : undefined}
                activeText={i === index ? activeText : null}
                showTextHint={i === index && tool === 'text' && !text}
              />
            </div>
          ))}
          <div className="shrink-0" style={{ width: EDGE }} aria-hidden />
        </div>
      </div>

      <div className="min-h-[7.5rem] pt-3">
        {tool === 'text' && text ? (
          <TextPanel
            text={text}
            onChange={(p) => activeText != null && patchText(activeText, p)}
            onRemove={() => {
              onChange(current.key, { texts: current.texts.filter((_, n) => n !== activeText) })
              setActiveText(null)
            }}
            onDone={() => {
              // An empty caption is not a caption.
              if (activeText != null && !current.texts[activeText]?.text.trim()) {
                onChange(current.key, { texts: current.texts.filter((_, n) => n !== activeText) })
              }
              setActiveText(null)
              setTool(null)
            }}
          />
        ) : tool === 'filter' && isImage ? (
          <FilterStrip item={current} onPick={(id) => onChange(current.key, { filter: id })} />
        ) : tool === 'adjust' && isImage ? (
          <AdjustPanel value={current.slider} onChange={(a) => onChange(current.key, { slider: a })} />
        ) : tool === 'crop' ? (
          <CropPanel aspect={aspect} onAspect={onAspect} />
        ) : !isImage && tool ? (
          <p className="px-6 text-center text-[12.5px] text-subtle">
            Filters and text work on photos. A video posts exactly as it was recorded.
          </p>
        ) : null}
      </div>

      <div className="flex justify-center gap-2 px-3 pt-2">
        <ToolButton icon={Type} label="Text" on={tool === 'text'} disabled={!isImage} onClick={() => addText(0.5, 0.5)} />
        <ToolButton icon={Sparkles} label="Filter" on={tool === 'filter'} disabled={!isImage} onClick={() => setTool(tool === 'filter' ? null : 'filter')} />
        <ToolButton icon={SlidersHorizontal} label="Adjust" on={tool === 'adjust'} disabled={!isImage} onClick={() => setTool(tool === 'adjust' ? null : 'adjust')} />
        <ToolButton icon={Crop} label="Crop" on={tool === 'crop'} onClick={() => setTool(tool === 'crop' ? null : 'crop')} />
      </div>

      {viewing != null && items[viewing] && (
        <FullPreview
          items={items}
          at={viewing}
          ratio={ratio}
          onMove={(i) => {
            setViewing(i)
            scrollToSlide(i)
          }}
          onClose={() => setViewing(null)}
        />
      )}

      <div className="flex items-center justify-between px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onAddMore}
          aria-label="Add more photos"
          className="relative grid size-12 place-items-center overflow-hidden rounded-xl border-2 border-fg/80"
        >
          {items[0]?.kind === 'image' && <img src={items[0].src} alt="" className="absolute inset-0 size-full object-cover opacity-50" />}
          <Plus size={22} className="relative text-white" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          Next
          <ArrowRight size={17} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function ToolButton({
  icon: Icon,
  label,
  on,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  label: string
  on: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        'flex w-[4.75rem] flex-col items-center gap-1 rounded-xl py-2.5 text-[12px] font-medium transition-colors duration-150 disabled:opacity-35',
        on ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-fg hover:bg-surface',
      )}
    >
      <Icon size={20} aria-hidden />
      {label}
    </button>
  )
}

/** Pointer capture throws for a pointer the browser does not know (a
 *  synthetic event, or one already released) — and a throw here aborts the
 *  handler before it listens for the release. Capture is a nicety; the
 *  window listeners do the work either way. */
function capture(el: HTMLElement, id: number) {
  try {
    el.setPointerCapture(id)
  } catch {
    /* fine: the window listeners below still see the release */
  }
}
