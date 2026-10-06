import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageOff, X } from 'lucide-react'
import { dmImageUrl } from '@/lib/dm-media'
import { cn } from '@/lib/cn'

/**
 * A photo in a conversation, at its own shape (clamped so a panorama or a
 * tall screenshot stays a sensible size), opening full-screen on a tap.
 * The space is held before it loads, so the thread does not jump.
 */
export function DmPhoto({ path, w, h, bare }: { path: string; w: number; h: number; bare?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const ratio = w > 0 && h > 0 ? Math.min(1.9, Math.max(0.6, w / h)) : 4 / 3

  useEffect(() => {
    let alive = true
    void dmImageUrl(path).then((u) => {
      if (!alive) return
      if (u) setUrl(u)
      else setFailed(true)
    })
    return () => { alive = false }
  }, [path])

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  return (
    <>
      <button type="button" onClick={() => url && setOpen(true)} aria-label="Open photo"
        className={cn('block w-[240px] max-w-full overflow-hidden rounded-2xl border border-border bg-surface-2', !bare && 'mt-1.5')}
        style={{ aspectRatio: ratio }}>
        {failed ? (
          <span className="flex h-full items-center justify-center gap-1.5 text-[12px] text-subtle"><ImageOff size={14} aria-hidden />Photo unavailable</span>
        ) : url ? (
          <img src={url} alt="Photo" className="size-full object-cover" draggable={false} />
        ) : (
          <span className="ct-shimmer block size-full" />
        )}
      </button>
      {open && url && createPortal(
        <div role="dialog" aria-label="Photo" onClick={() => setOpen(false)}
          className="ct-animate-fade fixed inset-0 z-[110] grid place-items-center bg-black/90 p-4">
          <img src={url} alt="Photo" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={18} aria-hidden />
          </button>
        </div>, document.body)}
    </>
  )
}
