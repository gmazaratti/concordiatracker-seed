import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  AtSign,
  Link2,
  Loader2,
  MapPin,
  Palette,
  Sparkles,
  Square,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { uploadOrgImage } from '@/lib/imageUpload'
import { publishPost, publishStory, type StoryOverlay } from '@/lib/social-posts'
import { CameraCapture, type CaptureMode } from './CameraCapture'
import { cn } from '@/lib/cn'
import type { PublishableOrg } from '../useMyOrgs'
import {
  DEFAULT_OVERLAY,
  STORY_ANIMS,
  STORY_COLORS,
  STORY_FONTS,
  animClass,
  fontClass,
  mentionsIn,
} from './story-text'

type Step = 'pick' | 'edit'

/**
 * Post a story.
 *
 * THE FRAME IS THE TRUTH. Text is positioned by DRAGGING it on the same 9:16
 * frame the viewer draws, and stored as a fraction of that frame — so what the
 * club sees while placing a caption is where it lands on every screen. An
 * absolute pixel offset would have been simpler and would have moved the text
 * off somebody's face on a different phone.
 *
 * WHAT IS DELIBERATELY NOT HERE: close friends (there is no close-friends
 * list, and a button that silently does nothing is worse than no button) and
 * music (we have no licence to any). Both were named as cuts in the brief.
 *
 * THE IMAGE IS RE-ENCODED BEFORE IT LEAVES THE BROWSER — `uploadOrgImage`
 * redraws it through a canvas, which destroys any embedded payload and strips
 * EXIF, so a story never ships the GPS coordinates of whoever took the photo.
 */
export function StoryComposer({
  orgs,
  onClose,
  onPosted,
}: {
  orgs: PublishableOrg[]
  onClose: () => void
  onPosted: () => void
}) {
  const [org, setOrg] = useState(orgs[0])
  const [step, setStep] = useState<Step>('pick')
  /** STORY or POST, chosen on the capture screen the way the reference does
   *  it — the same photo, two destinations, so asking afterwards would mean
   *  building the frame before knowing what shape it is. */
  const [mode, setMode] = useState<CaptureMode>('story')
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [overlays, setOverlays] = useState<StoryOverlay[]>([])
  const [active, setActive] = useState<number | null>(null)
  const [caption, setCaption] = useState('')
  const [place, setPlace] = useState('')
  const [link, setLink] = useState('')
  const [showPlace, setShowPlace] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const frame = useRef<HTMLDivElement | null>(null)

  // The object URL is revoked when it is replaced or the composer closes;
  // leaking one per photo adds up fast on a phone.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

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

  const choose = (f: File) => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setStep('edit')
  }

  const addText = () => {
    setOverlays((prev) => [...prev, { ...DEFAULT_OVERLAY, text: 'Tap to edit' }])
    setActive(overlays.length)
  }

  const patch = (i: number, p: Partial<StoryOverlay>) =>
    setOverlays((prev) => prev.map((o, n) => (n === i ? { ...o, ...p } : o)))

  /** Drag by pointer, in FRACTIONS of the frame. Pointer capture so the text
   *  keeps following once the finger leaves the box it started in. */
  const startDrag = (e: React.PointerEvent, i: number) => {
    const box = frame.current?.getBoundingClientRect()
    if (!box) return
    setActive(i)
    e.currentTarget.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      patch(i, {
        x: Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)),
        y: Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height)),
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const post = async () => {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadOrgImage(file, 'story')
      // Handles come from the captions AND from the description, because a
      // club writing "@jmsb" in either place means the same thing.
      const mentions = [
        ...new Set([...mentionsIn(caption), ...overlays.flatMap((o) => mentionsIn(o.text))]),
      ]
      const err =
        mode === 'post'
          ? // A post keeps the caption and drops the overlays: text dragged
            // onto a photo is a story idiom, and a post's caption sits under
            // the image where it can be read, searched and translated.
            await publishPost(org.id, caption, [{ url }])
          : await publishStory(org.id, {
              imageUrl: url,
              caption,
              overlays: overlays.filter((o) => o.text.trim()),
              mentions,
              place,
              linkUrl: link,
            })
      if (err) {
        setError(err)
        setBusy(false)
        return
      }
      onPosted()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post that.')
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[75] flex flex-col bg-canvas" role="dialog" aria-modal="true">
      {/* The capture screen carries its own chrome over the viewfinder — a
          second bar above it would sit on top of the photo you are framing. */}
      {step === 'edit' && (
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full bg-surface-2 text-fg"
        >
          <X size={17} aria-hidden />
        </button>
        <h2 className="flex-1 text-center text-[15px] font-semibold text-fg">
          {mode === 'post' ? 'New post' : 'Add to story'}
        </h2>
        <span className="size-8" />
      </header>
      )}

      {/* Which club is speaking. Only asked when there is a real choice. */}
      {step === 'edit' && orgs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
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

      {step === 'pick' ? (
        <CameraCapture mode={mode} onMode={setMode} onPick={choose} onClose={onClose} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-sm px-4 py-4">
            {/* 9:16, the shape a story is, so nothing shifts between here and
                the viewer. */}
            <div
              ref={frame}
              className={cn(
                'relative w-full overflow-hidden rounded-2xl bg-black',
                mode === 'post' ? 'aspect-square' : 'aspect-[9/16]',
              )}
            >
              {preview && <img src={preview} alt="" className="size-full object-contain" />}
              {overlays.map((o, i) => (
                <span
                  key={i}
                  onPointerDown={(e) => startDrag(e, i)}
                  onClick={() => setActive(i)}
                  className={cn(
                    'absolute max-w-[82%] -translate-x-1/2 -translate-y-1/2 cursor-move touch-none text-center text-[20px] leading-tight break-words whitespace-pre-wrap select-none',
                    fontClass(o.font),
                    animClass(o.anim),
                    o.chip && 'rounded-lg bg-black/55 px-2.5 py-1',
                    active === i && 'ring-2 ring-accent ring-offset-1 ring-offset-black/40',
                  )}
                  style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, color: o.color }}
                >
                  {o.text || ' '}
                </span>
              ))}
            </div>

            {/* Overlay tools are a STORY idiom. A post's words go in the
                caption, where they are readable, searchable and translatable —
                so the toolbar stands down rather than offering something the
                post will silently discard. */}
            <div className={cn('mt-3 flex flex-wrap gap-2', mode === 'post' && 'hidden')}>
              <ToolButton icon={Type} label="Add text" onClick={addText} />
              <ToolButton icon={AtSign} label="Mention" onClick={addMention} />
              <ToolButton
                icon={MapPin}
                label="Location"
                on={showPlace}
                onClick={() => setShowPlace((v) => !v)}
              />
              <ToolButton
                icon={Link2}
                label="Link"
                on={showLink}
                onClick={() => setShowLink((v) => !v)}
              />
            </div>

            {mode === 'story' && active != null && overlays[active] && (
              <TextTools
                overlay={overlays[active]}
                onChange={(p) => patch(active, p)}
                onRemove={() => {
                  setOverlays((prev) => prev.filter((_, n) => n !== active))
                  setActive(null)
                }}
              />
            )}

            {showPlace && (
              <Field
                icon={MapPin}
                value={place}
                onChange={setPlace}
                placeholder="Hall Building, H-920"
                label="Location"
              />
            )}
            {showLink && (
              <Field
                icon={Link2}
                value={link}
                onChange={setLink}
                placeholder="https://…"
                label="Link"
              />
            )}

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Add a caption…"
              className="mt-3 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />

            {error && <p className="mt-2 text-[12px] text-warning">{error}</p>}

            <div className="mt-3 flex items-center gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="rounded-full border border-border px-4 py-2.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
              >
                Change photo
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => void post()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
                {org.handle.replace(/^@/, '')}
                <ArrowRight size={15} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )

  /** A mention is text on the image, so it is a text overlay that starts with
   *  an @ rather than a separate kind of thing to store and draw. */
  function addMention() {
    setOverlays((prev) => [...prev, { ...DEFAULT_OVERLAY, y: 0.6, text: '@' }])
    setActive(overlays.length)
  }
}

function ToolButton({
  icon: Icon,
  label,
  on,
  onClick,
}: {
  icon: typeof Type
  label: string
  on?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
        on ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
      )}
    >
      <Icon size={13} aria-hidden />
      {label}
    </button>
  )
}

/** Everything about the selected caption, in one strip under the frame. */
function TextTools({
  overlay,
  onChange,
  onRemove,
}: {
  overlay: StoryOverlay
  onChange: (p: Partial<StoryOverlay>) => void
  onRemove: () => void
}) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-surface p-3">
      <textarea
        value={overlay.text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={2}
        maxLength={140}
        placeholder="Your text. Type @handle to tag a club."
        className="w-full resize-none rounded-lg border border-border bg-canvas px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
      />

      <Row icon={Type} label="Font">
        {STORY_FONTS.map((f) => (
          <Chip key={f.id} on={overlay.font === f.id} onClick={() => onChange({ font: f.id })}>
            <span className={f.className}>{f.label}</span>
          </Chip>
        ))}
      </Row>

      <Row icon={Palette} label="Colour">
        {STORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ color: c })}
            aria-label={c}
            aria-pressed={overlay.color === c}
            className={cn(
              'size-6 shrink-0 rounded-full border transition-transform duration-150',
              overlay.color === c ? 'scale-110 border-accent' : 'border-border',
            )}
            style={{ background: c }}
          />
        ))}
      </Row>

      <Row icon={Sparkles} label="Animation">
        {STORY_ANIMS.map((a) => (
          <Chip key={a.id} on={overlay.anim === a.id} onClick={() => onChange({ anim: a.id })}>
            {a.label}
          </Chip>
        ))}
      </Row>

      <div className="flex items-center gap-2">
        <Chip on={overlay.chip} onClick={() => onChange({ chip: !overlay.chip })}>
          <Square size={11} className="mr-1 inline" aria-hidden />
          Backdrop
        </Chip>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] text-muted transition-colors duration-150 hover:border-danger hover:text-danger"
        >
          <Trash2 size={12} aria-hidden />
          Remove
        </button>
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Type
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} className="shrink-0 text-subtle" aria-hidden />
      <span className="sr-only">{label}</span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'shrink-0 rounded-full border px-2.5 py-1 text-[12px] transition-colors duration-150',
        on ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

function Field({
  icon: Icon,
  value,
  onChange,
  placeholder,
  label,
}: {
  icon: typeof MapPin
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
}) {
  return (
    <label className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Icon size={14} className="shrink-0 text-subtle" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none"
      />
    </label>
  )
}
