import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { FILTERS, cssFilter, presetAdjust, type Adjust, type AspectId, type PhotoText } from './photo-edit'
import type { ComposeItem } from './items'

/** The same fixed palette stories use — a caption's colour is part of the
 *  picture, so it must not follow anybody's theme. */
const TEXT_COLORS = ['#ffffff', '#111111', '#f5c542', '#ff5a5f', '#7ad3ff', '#8fb39a', '#c79bff']

const FONTS: { id: PhotoText['font']; label: string; className: string }[] = [
  { id: 'modern', label: 'Modern', className: 'font-display font-bold' },
  { id: 'classic', label: 'Classic', className: 'font-semibold' },
  { id: 'signature', label: 'Signature', className: 'font-display italic' },
  { id: 'typewriter', label: 'Typewriter', className: 'font-mono' },
]

export function FilterStrip({ item, onPick }: { item: ComposeItem; onPick: (id: string) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {FILTERS.map((f) => {
        const css = cssFilter(presetAdjust(f.id))
        const on = item.filter === f.id
        return (
          <button key={f.id} type="button" onClick={() => onPick(f.id)} className="flex shrink-0 flex-col items-center gap-1.5">
            <span className={cn('block size-16 overflow-hidden rounded-lg border-2', on ? 'border-accent' : 'border-transparent')}>
              {item.kind === 'image' ? (
                <img src={item.src} alt="" className="size-full object-cover" style={{ filter: css === 'none' ? undefined : css }} />
              ) : (
                <span className="block size-full bg-surface-2" />
              )}
            </span>
            <span className={cn('text-[11.5px] font-medium', on ? 'text-fg' : 'text-subtle')}>{f.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const SLIDERS: { key: keyof Adjust; label: string; min: number; max: number; step: number; neutral: number }[] = [
  { key: 'brightness', label: 'Brightness', min: 0.6, max: 1.4, step: 0.01, neutral: 1 },
  { key: 'contrast', label: 'Contrast', min: 0.6, max: 1.4, step: 0.01, neutral: 1 },
  { key: 'saturate', label: 'Saturation', min: 0, max: 2, step: 0.02, neutral: 1 },
  { key: 'sepia', label: 'Warmth', min: 0, max: 0.6, step: 0.01, neutral: 0 },
]

export function AdjustPanel({ value, onChange }: { value: Adjust; onChange: (a: Adjust) => void }) {
  return (
    <div className="flex flex-col gap-2.5 px-4">
      {SLIDERS.map((s) => (
        <label key={s.key} className="flex items-center gap-3 text-[12.5px] text-muted">
          <span className="w-20 shrink-0">{s.label}</span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={value[s.key]}
            onChange={(e) => onChange({ ...value, [s.key]: Number(e.target.value) })}
            onDoubleClick={() => onChange({ ...value, [s.key]: s.neutral })}
            className="ct-range min-w-0 flex-1"
          />
          <span className="w-9 shrink-0 text-right tabular-nums text-subtle">
            {Math.round((value[s.key] - s.neutral) * 100)}
          </span>
        </label>
      ))}
    </div>
  )
}

export function CropPanel({ aspect, onAspect }: { aspect: AspectId; onAspect: (a: AspectId) => void }) {
  const opts: { id: AspectId; label: string }[] = [
    { id: 'square', label: 'Square' },
    { id: 'portrait', label: 'Portrait 4:5' },
    { id: 'original', label: 'Original' },
  ]
  return (
    <div className="px-4">
      <div className="flex gap-2">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onAspect(o.id)}
            aria-pressed={aspect === o.id}
            className={cn(
              'flex-1 rounded-full border px-3 py-2 text-[12.5px] font-medium transition-colors',
              aspect === o.id ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11.5px] text-subtle">
        Drag the photo to choose what stays in the frame. The shape applies to every photo in the post.
      </p>
    </div>
  )
}

export function TextPanel({
  text,
  onChange,
  onRemove,
  onDone,
}: {
  text: PhotoText
  onChange: (p: Partial<PhotoText>) => void
  onRemove: () => void
  onDone: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={text.text}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && onDone()}
          maxLength={120}
          placeholder="Type something"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-3.5 py-2 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove text"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:border-danger hover:text-danger"
        >
          <Trash2 size={15} aria-hidden />
        </button>
        <button type="button" onClick={onDone} className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-contrast">
          Done
        </button>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ color: c })}
            aria-label={`Colour ${c}`}
            aria-pressed={text.color === c}
            className={cn('size-7 shrink-0 rounded-full border-2', text.color === c ? 'border-accent' : 'border-white/30')}
            style={{ background: c }}
          />
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <button
          type="button"
          onClick={() => onChange({ chip: !text.chip })}
          aria-pressed={text.chip}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1 text-[12px] transition-colors',
            text.chip ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted',
          )}
        >
          Backdrop
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange({ font: f.id })}
            aria-pressed={text.font === f.id}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-[12.5px] transition-colors',
              f.className,
              text.font === f.id ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
