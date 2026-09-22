import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, Loader2, Play, X } from 'lucide-react'
import { MEDIA_ACCEPT_ATTR, uploadOrgImageSized, uploadOrgVideo } from '@/lib/imageUpload'
import { publishPost, type PostMedia } from '@/lib/social-posts'
import { cn } from '@/lib/cn'
import type { PublishableOrg } from '../useMyOrgs'

const MAX = 10

/**
 * Publish a post as an organisation.
 *
 * IMAGES UPLOAD AS YOU ADD THEM, not on Publish. Uploading ten photos the
 * moment somebody presses the button means the button appears to hang, and a
 * failure at that point loses the caption they just wrote. This way each
 * thumbnail either appears or says why, and Publish is a single cheap insert.
 *
 * SINGLE IMAGE OR SLIDESHOW IS NOT A MODE. Add one picture and it is a post;
 * add more and it is a carousel. Asking which one up front is a question the
 * answer to which is already visible on screen.
 *
 * NEITHER IS VIDEO. One picker takes both, the file decides which upload path
 * it goes down, and a clip sits in the feed alongside the photographs. A
 * "video post" mode would be a second composer that asks you to categorise
 * your own file before it will let you choose it.
 */
export function PostComposer({
  orgs,
  onClose,
  onPosted,
}: {
  orgs: PublishableOrg[]
  onClose: () => void
  onPosted: () => void
}) {
  const [org, setOrg] = useState(orgs[0])
  const [media, setMedia] = useState<PostMedia[]>([])
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const add = async (files: FileList) => {
    const room = MAX - media.length
    const chosen = [...files].slice(0, Math.max(0, room))
    if (chosen.length === 0) return
    setError(null)
    setUploading((n) => n + chosen.length)
    for (const f of chosen) {
      try {
        // The file says what it is; nobody is asked to declare it.
        const item = f.type.startsWith('video/')
          ? await uploadOrgVideo(f)
          : await uploadOrgImageSized(f, 'post')
        setMedia((prev) => [...prev, item])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'One file could not be uploaded.')
      } finally {
        setUploading((n) => Math.max(0, n - 1))
      }
    }
  }

  const publish = async () => {
    if (busy || media.length === 0) return
    setBusy(true)
    const err = await publishPost(org.id, caption, media)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    onPosted()
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-border bg-surface sm:max-w-lg sm:rounded-2xl">
        <span className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden" />
        <header className="flex items-center gap-2 px-4 pt-3 pb-2">
          <h2 className="flex-1 text-[15px] font-semibold text-fg">New post</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-lg text-subtle hover:text-fg"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        {orgs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2">
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOrg(o)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
                  o.id === org.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border text-muted hover:text-fg',
                )}
              >
                {o.handle.replace(/^@/, '')}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {media.map((m, i) => (
              <div key={m.url} className="relative aspect-square overflow-hidden rounded-lg bg-black">
                {m.kind === 'video' ? (
                  <>
                    {/* Muted, no controls: this is a thumbnail, not a player.
                        The first frame is all it has to say. */}
                    <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />
                    <span className="pointer-events-none absolute inset-0 grid place-items-center text-white/85">
                      <Play size={18} className="fill-current" aria-hidden />
                    </span>
                  </>
                ) : (
                  <img src={m.url} alt="" className="size-full object-cover" />
                )}
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setMedia((prev) => prev.filter((_, n) => n !== i))}
                  className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X size={11} aria-hidden />
                </button>
                {/* The order is the slideshow order, so it has to be visible
                    while you are still choosing. */}
                {media.length > 1 && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white tabular-nums">
                    {i + 1}
                  </span>
                )}
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`u-${i}`} className="ct-shimmer aspect-square rounded-lg" />
            ))}
            {media.length + uploading < MAX && (
              <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border-2 border-dashed border-border text-subtle transition-colors duration-150 hover:border-accent hover:text-accent">
                <ImagePlus size={20} aria-hidden />
                <span className="sr-only">Add photos or video</span>
                <input
                  type="file"
                  multiple
                  accept={MEDIA_ACCEPT_ATTR}
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) void add(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            maxLength={2200}
            placeholder="Write a caption…"
            className="mt-3 w-full resize-none rounded-xl border border-border bg-canvas px-3 py-2.5 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          {error && <p className="mt-2 text-[12px] text-warning">{error}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <span className="flex-1 text-[11.5px] text-subtle">
            Posting as {org.handle.replace(/^@/, '')} · {media.length}/{MAX}
          </span>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy || media.length === 0 || uploading > 0}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Share
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
