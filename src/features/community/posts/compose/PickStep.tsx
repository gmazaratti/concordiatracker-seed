import { useRef, useState } from 'react'
import { AlertTriangle, Camera, Copy, ImagePlus, Maximize2, Minimize2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { PublishableOrg } from '../../useMyOrgs'
import { PICK_ACCEPT, type ComposeItem } from './items'
import { PhotoFrame } from './PhotoFrame'
import type { AspectId } from './photo-edit'

export const MAX_ITEMS = 10

/**
 * Screen 1 of 3: choose what goes in the post.
 *
 * WHAT A WEB PAGE CANNOT DO: list your camera roll. A browser will not
 * enumerate your photos, so the grid is the photos you have handed it — the
 * Camera tile and the Add tile open the phone's own camera and library, and
 * whatever comes back lands here straight away. Pretending to be a camera
 * roll with a half-empty grid would be worse than saying what it is.
 *
 * ERRORS SIT AT THE TOP, where the eye already is. The old composer printed a
 * refusal at the bottom of a long sheet, under the fold, so a file the browser
 * could not read looked like nothing had happened at all.
 */
export function PickStep({
  orgs,
  org,
  onOrg,
  items,
  selected,
  focus,
  multi,
  aspect,
  ratio,
  error,
  onFiles,
  onToggle,
  onMulti,
  onAspect,
  onClose,
  onNext,
  onSwitchToStory,
}: {
  orgs: PublishableOrg[]
  org: PublishableOrg
  onOrg: (o: PublishableOrg) => void
  items: ComposeItem[]
  selected: string[]
  focus: ComposeItem | null
  multi: boolean
  aspect: AspectId
  ratio: number
  error: string | null
  onFiles: (files: File[]) => void
  onToggle: (key: string) => void
  onMulti: () => void
  onAspect: (a: AspectId) => void
  onClose: () => void
  onNext: () => void
  onSwitchToStory?: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const device = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  const take = (list: FileList | null) => {
    if (list && list.length) onFiles([...list])
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        take(e.dataTransfer.files)
      }}
    >
      <header className="flex items-center gap-2 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg transition-colors hover:bg-surface"
        >
          <X size={20} aria-hidden />
        </button>
        <h2 className="flex-1 text-center text-[16px] font-semibold text-fg">New post</h2>
        <button
          type="button"
          onClick={onNext}
          disabled={selected.length === 0}
          className="rounded-full px-3.5 py-2 text-[15px] font-semibold text-accent transition-opacity disabled:opacity-35"
        >
          Next
        </button>
      </header>

      {orgs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onOrg(o)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
                o.id === org.id ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
              )}
            >
              {o.handle.replace(/^@/, '')}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-fg">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <span className="min-w-0">{error}</span>
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* The one that will lead the post, at the shape it will post in. */}
        <div className="relative bg-black">
          {focus ? (
            <PhotoFrame item={focus} ratio={ratio} />
          ) : (
            <button
              type="button"
              onClick={() => device.current?.click()}
              className="grid aspect-square w-full place-items-center text-white/70"
            >
              <span className="flex flex-col items-center gap-2 text-[13.5px]">
                <ImagePlus size={30} aria-hidden />
                Choose photos or a video
                <span className="text-[12px] text-white/50">or drop them here</span>
              </span>
            </button>
          )}
          {focus && (
            <button
              type="button"
              onClick={() => onAspect(aspect === 'square' ? 'original' : 'square')}
              aria-label={aspect === 'square' ? 'Show the whole photo' : 'Crop to a square'}
              title={aspect === 'square' ? 'Show the whole photo' : 'Crop to a square'}
              className="absolute bottom-3 left-3 grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm"
            >
              {aspect === 'square' ? <Maximize2 size={16} aria-hidden /> : <Minimize2 size={16} aria-hidden />}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-[17px] font-semibold text-fg">Your photos</span>
          <button
            type="button"
            onClick={onMulti}
            aria-pressed={multi}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors duration-150',
              multi ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-fg hover:bg-surface',
            )}
          >
            <Copy size={14} aria-hidden />
            Select
          </button>
        </div>

        <div className="grid grid-cols-4 gap-0.5">
          <Tile onClick={() => camera.current?.click()} label="Camera">
            <Camera size={24} aria-hidden />
          </Tile>
          <Tile onClick={() => device.current?.click()} label="Add">
            <ImagePlus size={24} aria-hidden />
          </Tile>
          {items.map((it) => {
            const n = selected.indexOf(it.key)
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onToggle(it.key)}
                aria-pressed={n >= 0}
                className="relative aspect-square overflow-hidden bg-surface-2"
              >
                {it.kind === 'video' ? (
                  <video src={it.src} muted playsInline preload="metadata" className="size-full object-cover" />
                ) : (
                  <img src={it.src} alt="" className="size-full object-cover" />
                )}
                {focus?.key === it.key && <span className="absolute inset-0 bg-white/25" aria-hidden />}
                {multi && (
                  <span
                    className={cn(
                      'absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full border-2 text-[11.5px] font-semibold',
                      n >= 0 ? 'border-white bg-accent text-accent-contrast' : 'border-white/90 bg-black/20',
                    )}
                  >
                    {n >= 0 ? n + 1 : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {items.length === 0 && (
          <p className="px-4 py-6 text-center text-[12.5px] leading-relaxed text-subtle">
            Your browser keeps your photo library private, so nothing appears here until you
            pick it. Tap Add, take one with Camera, or drag files onto this window.
          </p>
        )}
        <div className="h-24" />
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center border-2 border-dashed border-accent bg-accent/10 text-[14px] font-medium text-fg">
          Drop to add
        </div>
      )}

      {/* POST | STORY, where the reference puts them. */}
      {onSwitchToStory && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/70 p-1 backdrop-blur-md">
            <span className="rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold tracking-wide text-white uppercase">
              Post
            </span>
            <button
              type="button"
              onClick={onSwitchToStory}
              className="rounded-full px-4 py-2 text-[13px] font-semibold tracking-wide text-white/60 uppercase transition-colors hover:text-white"
            >
              Story
            </button>
          </div>
        </div>
      )}

      <input
        ref={device}
        type="file"
        multiple
        accept={PICK_ACCEPT}
        className="hidden"
        onChange={(e) => {
          take(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />
      {/* `capture` opens the camera on a phone; a desktop browser ignores it
          and shows the file picker, which is the honest fallback. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          take(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}

function Tile({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-1.5 bg-surface-2 text-fg transition-colors hover:bg-surface"
    >
      {children}
      <span className="text-[11.5px] font-medium text-muted">{label}</span>
    </button>
  )
}
