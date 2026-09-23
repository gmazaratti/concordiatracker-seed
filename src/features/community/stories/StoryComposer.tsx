import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, AtSign, ChevronDown, Link2, Loader2, MapPin, SmilePlus, Star, X } from 'lucide-react'
import { uploadRenderedImage } from '@/lib/imageUpload'
import { publishStory, type StoryOverlay } from '@/lib/social-posts'
import { OrgLogo } from '../OrgLogo'
import { CameraCapture } from './CameraCapture'
import { StoryTextTools } from './StoryTextTools'
import { renderPhoto } from '../posts/compose/render-photo'
import { NO_ADJUST } from '../posts/compose/photo-edit'
import { cn } from '@/lib/cn'
import type { PublishableOrg } from '../useMyOrgs'
import type { EventOrg } from '@/data/community'
import { DEFAULT_OVERLAY, animClass, fontClass, mentionsIn } from './story-text'

const STORY_RATIO = 9 / 16
/** The largest 9:16 box inside the size container around it. */
const FRAME_FIT: React.CSSProperties = { width: 'min(100cqw, calc(100cqh * 9 / 16))', aspectRatio: '9 / 16' }

/**
 * Post a story — laid out like the reference: the photo nearly full-screen,
 * the tools down its right edge, the caption on the photo, and who it goes to
 * along the bottom.
 *
 * WHAT YOU FRAME IS WHAT POSTS. Three rectangles used to disagree: the camera
 * viewfinder filled the screen, the captured frame was the camera's whole
 * sensor, and the viewer letterboxed whatever it was sent. Now the viewfinder
 * IS the 9:16 frame, the shutter keeps only what was visible in it, and the
 * story is drawn to exactly 9:16 before it uploads — so the viewer's "fit"
 * and "fill" are the same picture.
 *
 * TEXT: the Aa button, or tap anywhere on the photo and it starts there. Drag
 * to move it. Dragging the PHOTO (not the text) moves it inside the frame.
 *
 * WHAT IS NOT HERE, and why: music (we have no licence to any) and a working
 * Close Friends (there is no close-friends list yet — the pill is shown,
 * marked Soon, rather than pretending).
 */
export function StoryComposer({
  orgs,
  onClose,
  onPosted,
  onSwitchToPost,
}: {
  orgs: PublishableOrg[]
  onClose: () => void
  onPosted: () => void
  onSwitchToPost?: () => void
}) {
  const [org, setOrg] = useState(orgs[0])
  const [photo, setPhoto] = useState<{ src: string; w: number; h: number } | null>(null)
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 })
  const [overlays, setOverlays] = useState<StoryOverlay[]>([])
  const [active, setActive] = useState<number | null>(null)
  const [caption, setCaption] = useState('')
  const [place, setPlace] = useState('')
  const [link, setLink] = useState('')
  const [sheet, setSheet] = useState<null | 'stickers' | 'place' | 'link'>(null)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const frame = useRef<HTMLDivElement | null>(null)
  const photoRef = useRef(photo)

  useEffect(() => {
    photoRef.current = photo
  }, [photo])
  // Released when replaced below, and on the way out — not from an effect on
  // `photo`, which in development runs its cleanup straight after mounting
  // and revokes the URL the <img> is about to load (a black preview).
  useEffect(() => () => {
    if (photoRef.current?.src.startsWith('blob:')) URL.revokeObjectURL(photoRef.current.src)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, busy])

  const choose = (f: File) => {
    setError(null)
    const src = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      if (photo?.src.startsWith('blob:')) URL.revokeObjectURL(photo.src)
      setPhoto({ src, w: img.naturalWidth, h: img.naturalHeight })
      setPan({ x: 0.5, y: 0.5 })
    }
    img.onerror = () => {
      URL.revokeObjectURL(src)
      setError(
        /\.(heic|heif)$/i.test(f.name)
          ? `${f.name}: HEIC photos cannot be opened in this browser. Export it as JPG and try again.`
          : `${f.name} could not be opened.`,
      )
    }
    img.src = src
  }

  const addText = (x = 0.5, y = 0.4) => {
    setOverlays((prev) => [...prev, { ...DEFAULT_OVERLAY, x, y, text: '' }])
    setActive(overlays.length)
    setSheet(null)
  }
  const addSticker = (text: string) => {
    setOverlays((prev) => [...prev, { ...DEFAULT_OVERLAY, y: 0.62, text }])
    setActive(overlays.length)
    setSheet(null)
  }
  const patch = (i: number, p: Partial<StoryOverlay>) =>
    setOverlays((prev) => prev.map((o, n) => (n === i ? { ...o, ...p } : o)))

  /** One pointer model for the photo: a tap adds text there, a drag pans. */
  const onPhotoPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!photo || (e.target as HTMLElement).dataset.overlay) return
    const box = e.currentTarget.getBoundingClientRect()
    const start = { x: e.clientX, y: e.clientY, pan }
    const imgRatio = photo.w / photo.h
    const overX = imgRatio > STORY_RATIO ? box.height * imgRatio - box.width : 0
    const overY = imgRatio > STORY_RATIO ? 0 : box.width / imgRatio - box.height
    let moved = false
    capture(e.currentTarget, e.pointerId)
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      if (!moved && Math.hypot(dx, dy) < 6) return
      moved = true
      const clamp = (v: number) => Math.min(1, Math.max(0, v))
      setPan({
        x: overX > 0 ? clamp(start.pan.x - dx / overX) : 0.5,
        y: overY > 0 ? clamp(start.pan.y - dy / overY) : 0.5,
      })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!moved) {
        if (active != null) setActive(null)
        else addText((ev.clientX - box.left) / box.width, (ev.clientY - box.top) / box.height)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const dragText = (e: React.PointerEvent, i: number) => {
    e.stopPropagation()
    const box = frame.current?.getBoundingClientRect()
    if (!box) return
    setActive(i)
    capture(e.currentTarget as HTMLElement, e.pointerId)
    const move = (ev: PointerEvent) =>
      patch(i, {
        x: Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)),
        y: Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height)),
      })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const post = async () => {
    if (!photo || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await renderPhoto({ src: photo.src, ratio: STORY_RATIO, panX: pan.x, panY: pan.y, adjust: NO_ADJUST, texts: [], longEdge: 1600 })
      const url = await uploadRenderedImage(r.blob, 'story')
      const kept = overlays.filter((o) => o.text.trim())
      const mentions = [...new Set([...mentionsIn(caption), ...kept.flatMap((o) => mentionsIn(o.text))])]
      const err = await publishStory(org.id, { imageUrl: url, caption, overlays: kept, mentions, place, linkUrl: link })
      if (err) throw new Error(err)
      onPosted()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post that.')
      setBusy(false)
    }
  }

  const activeOverlay = active != null ? overlays[active] : undefined

  return createPortal(
    <div className="fixed inset-0 z-[75] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="New story">
      {!photo ? (
        <CameraCapture mode="story" onMode={(m) => m === 'post' && onSwitchToPost?.()} canPost={!!onSwitchToPost} onPick={choose} onClose={onClose} />
      ) : (
        <>
          {orgs.length > 1 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 [scrollbar-width:none]">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOrg(o)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
                    o.id === org.id ? 'border-accent bg-accent/20 text-white' : 'border-white/20 text-white/70 hover:text-white',
                  )}
                >
                  {o.handle.replace(/^@/, '')}
                </button>
              ))}
            </div>
          )}

          {/* A SIZE CONTAINER, so the frame can be the largest 9:16 that
              fits. `h-full` + `max-w-full` + an aspect ratio loses the ratio
              the moment the screen is narrower than the height allows — the
              browser keeps the height and clamps the width — which on a phone
              made the preview 0.49 wide instead of 0.5625, a different
              picture from the one that posts. */}
          <div className={cn('flex min-h-0 flex-1 items-center justify-center px-2 [container-type:size]', orgs.length <= 1 && 'pt-[calc(0.5rem+env(safe-area-inset-top))]')}>
            <div
              ref={frame}
              onPointerDown={onPhotoPointerDown}
              className="relative overflow-hidden rounded-[22px] bg-neutral-900 [container-type:inline-size] touch-none select-none"
              style={FRAME_FIT}
            >
              <img
                src={photo.src}
                alt=""
                draggable={false}
                className="size-full object-cover"
                style={{ objectPosition: `${pan.x * 100}% ${pan.y * 100}%` }}
              />

              {overlays.map((o, i) => (
                <span
                  key={i}
                  data-overlay="1"
                  onPointerDown={(e) => dragText(e, i)}
                  className={cn(
                    'absolute max-w-[82%] -translate-x-1/2 -translate-y-1/2 cursor-move text-center text-[6.6cqw] leading-tight break-words whitespace-pre-wrap',
                    fontClass(o.font),
                    animClass(o.anim),
                    o.chip && 'rounded-lg bg-black/55 px-2.5 py-1',
                    active === i && 'outline-2 outline-offset-4 outline-white/80 outline-dashed',
                  )}
                  style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, color: o.color }}
                >
                  {o.text || (active === i ? ' ' : 'Tap to type')}
                </span>
              ))}

              <button
                type="button"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Close"
                className="absolute top-3 left-3 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"
              >
                <X size={24} aria-hidden />
              </button>

              {/* The rail, down the right edge where the reference has it. */}
              <div className="absolute top-3 right-3 flex flex-col items-center gap-3" onPointerDown={(e) => e.stopPropagation()}>
                <RailButton label="Add text" onClick={() => addText()}>
                  <span className="text-[22px] leading-none font-semibold">Aa</span>
                </RailButton>
                <RailButton label="Stickers" on={sheet === 'stickers'} onClick={() => setSheet(sheet === 'stickers' ? null : 'stickers')}>
                  <SmilePlus size={24} aria-hidden />
                </RailButton>
                <RailButton label="More" on={more} onClick={() => setMore((v) => !v)} small>
                  <ChevronDown size={20} className={cn('transition-transform', more && 'rotate-180')} aria-hidden />
                </RailButton>
                {more && (
                  <>
                    <RailButton label="Location" on={!!place} onClick={() => setSheet('place')}>
                      <MapPin size={22} aria-hidden />
                    </RailButton>
                    <RailButton label="Link" on={!!link} onClick={() => setSheet('link')}>
                      <Link2 size={22} aria-hidden />
                    </RailButton>
                  </>
                )}
              </div>

              {sheet === 'stickers' && (
                <div className="absolute top-3 right-[4.25rem] w-48 rounded-2xl bg-black/80 p-1.5 backdrop-blur-md" onPointerDown={(e) => e.stopPropagation()}>
                  <SheetItem icon={AtSign} label="Mention a club" onClick={() => addSticker('@')} />
                  <SheetItem icon={MapPin} label="Location" onClick={() => setSheet('place')} />
                  <SheetItem icon={Link2} label="Link" onClick={() => setSheet('link')} />
                </div>
              )}

              {/* The caption lives ON the photo, bottom-left, as in the reference. */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pt-10 pb-4" onPointerDown={(e) => e.stopPropagation()}>
                {(place || link) && (
                  <p className="mb-1 truncate text-[12px] text-white/80">
                    {place && <span className="mr-2">📍 {place}</span>}
                    {link && <span>🔗 {link.replace(/^https?:\/\//, '')}</span>}
                  </p>
                )}
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={500}
                  placeholder="Add a caption..."
                  className="w-full bg-transparent text-[15px] font-medium text-white placeholder:text-white/85 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {activeOverlay && active != null && (
            <StoryTextTools
              overlay={activeOverlay}
              onChange={(p) => patch(active, p)}
              onRemove={() => {
                setOverlays((prev) => prev.filter((_, n) => n !== active))
                setActive(null)
              }}
              onDone={() => {
                if (!activeOverlay.text.trim()) setOverlays((prev) => prev.filter((_, n) => n !== active))
                setActive(null)
              }}
            />
          )}

          {(sheet === 'place' || sheet === 'link') && (
            <div className="flex shrink-0 items-center gap-2 px-3 pt-2">
              {sheet === 'place' ? <MapPin size={16} className="shrink-0 text-white/70" aria-hidden /> : <Link2 size={16} className="shrink-0 text-white/70" aria-hidden />}
              <input
                autoFocus
                value={sheet === 'place' ? place : link}
                onChange={(e) => (sheet === 'place' ? setPlace(e.target.value) : setLink(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && setSheet(null)}
                placeholder={sheet === 'place' ? 'Hall Building, H-920' : 'https://…'}
                className="min-w-0 flex-1 rounded-full bg-white/10 px-3.5 py-2 text-[14px] text-white placeholder:text-white/50 focus:outline-none"
              />
              <button type="button" onClick={() => setSheet(null)} className="rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-black">
                Done
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mx-3 mt-2 flex items-start gap-2 rounded-xl bg-danger/25 px-3 py-2 text-[12.5px] text-white">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {/* Who it goes to, and go. */}
          <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <span className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white/12 px-2 py-2">
              <OrgLogo org={faceOf(org)} className="size-9 ring-2 ring-white" rounded="rounded-full" textClass="text-[11px]" />
              <span className="min-w-0 flex-1 truncate text-center text-[15px] font-medium">Your story</span>
            </span>
            <span
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white/12 px-2 py-2 opacity-60"
              title="There is no close-friends list yet."
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white">
                <Star size={16} className="fill-current" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-center text-[15px] font-medium">
                Close Friends <span className="ml-0.5 rounded bg-white/15 px-1 text-[10px] font-semibold tracking-wide uppercase">Soon</span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => void post()}
              disabled={busy}
              aria-label={`Share to ${org.handle}'s story`}
              className="grid size-[52px] shrink-0 place-items-center rounded-full bg-accent text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <ArrowRight size={24} aria-hidden />}
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

function RailButton({
  label,
  on,
  small,
  onClick,
  children,
}: {
  label: string
  on?: boolean
  small?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={on}
      className={cn(
        'grid place-items-center rounded-full text-white backdrop-blur-sm transition-colors',
        small ? 'h-8 w-12' : 'size-12',
        on ? 'bg-white text-black' : 'bg-black/55 hover:bg-black/70',
      )}
    >
      {children}
    </button>
  )
}

function SheetItem({ icon: Icon, label, onClick }: { icon: typeof MapPin; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-white hover:bg-white/10">
      <Icon size={16} aria-hidden />
      {label}
    </button>
  )
}

/** Just enough of an org for its logo tile. */
function faceOf(o: PublishableOrg): EventOrg {
  return {
    name: o.name,
    handle: o.handle,
    verified: o.verified,
    glyph: o.glyph ?? o.name.slice(0, 2).toUpperCase(),
    color: o.color ?? '#4b5563',
    logo: o.logo ?? undefined,
  } as EventOrg
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
