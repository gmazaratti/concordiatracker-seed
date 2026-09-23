import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { PhotoFrame } from './PhotoFrame'
import type { ComposeItem } from './items'

/**
 * One photo, as big as the screen allows, exactly as it will post — the same
 * `PhotoFrame`, so the crop, the filter and the text are the real ones.
 * Arrows and ←/→ step through the post; Escape or a tap on the dark closes.
 */
export function FullPreview({
  items,
  at,
  ratio,
  onMove,
  onClose,
}: {
  items: ComposeItem[]
  at: number
  ratio: number
  onMove: (i: number) => void
  onClose: () => void
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowRight' && at < items.length - 1) onMove(at + 1)
      else if (e.key === 'ArrowLeft' && at > 0) onMove(at - 1)
    }
    document.addEventListener('keydown', key, true)
    return () => document.removeEventListener('keydown', key, true)
  }, [at, items.length, onMove, onClose])

  const nav = 'grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25'
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
      className="ct-animate-fade fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <button type="button" onClick={onClose} aria-label="Close preview" className={`${nav} absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3`}>
        <X size={20} aria-hidden />
      </button>
      {items.length > 1 && (
        <span className="absolute top-[calc(1.35rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 text-[13px] text-white/80">
          {at + 1} of {items.length}
        </span>
      )}
      {/* Sized to fit BOTH ways: as wide as it can be without the frame
          (at this ratio) growing taller than the screen. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: `min(100%, 560px, calc((100dvh - 6rem) * ${ratio}))` }}
      >
        <PhotoFrame item={items[at]} ratio={ratio} className="rounded-2xl" />
      </div>
      {at > 0 && (
        <button
          type="button"
          aria-label="Previous photo"
          onClick={(e) => {
            e.stopPropagation()
            onMove(at - 1)
          }}
          className={`${nav} absolute top-1/2 left-3 -translate-y-1/2`}
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
      )}
      {at < items.length - 1 && (
        <button
          type="button"
          aria-label="Next photo"
          onClick={(e) => {
            e.stopPropagation()
            onMove(at + 1)
          }}
          className={`${nav} absolute top-1/2 right-3 -translate-y-1/2`}
        >
          <ChevronRight size={22} aria-hidden />
        </button>
      )}
    </div>,
    document.body,
  )
}
