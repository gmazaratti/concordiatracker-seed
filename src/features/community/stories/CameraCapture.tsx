import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, RefreshCw, X } from 'lucide-react'
import { IMAGE_ACCEPT_ATTR } from '@/lib/imageUpload'
import { cn } from '@/lib/cn'

export type CaptureMode = 'story' | 'post'

/**
 * The capture screen: a live camera by default, the camera roll one tap away,
 * and POST / STORY along the bottom.
 *
 * WHAT A WEB APP CAN AND CANNOT DO HERE, said plainly because the difference
 * shapes the design:
 *
 *   • A LIVE VIEWFINDER is real — `getUserMedia` gives us the camera stream
 *     and a canvas grab gives us the frame. That is what opens by default,
 *     because "take a photo of this, now" is what a story is for.
 *   • AN IN-APP GRID OF YOUR CAMERA ROLL IS NOT POSSIBLE from a web page. A
 *     browser will not enumerate your photos; the only way in is the OS
 *     picker, which IS the camera roll and which the Gallery button opens.
 *     Drawing our own thumbnail grid would mean a native plugin. So the
 *     button says Gallery and hands you the real thing, rather than a
 *     half-grid that pretends.
 *
 * PERMISSION IS ASKED WHEN YOU ARRIVE, not behind another tap: this screen
 * exists to take a photo, and a viewfinder that needs a button pressed before
 * it will even ask is a screen that looks broken. A refusal falls back to the
 * gallery and says why.
 */
export function CameraCapture({
  mode,
  onMode,
  onPick,
  onClose,
}: {
  mode: CaptureMode
  onMode: (m: CaptureMode) => void
  onPick: (file: File) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [denied, setDenied] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This device has no camera we can open from the browser.')
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        })
        if (!alive) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream.current = s
        if (video.current) {
          video.current.srcObject = s
          await video.current.play().catch(() => {})
        }
        setReady(true)
      } catch (e) {
        if (!alive) return
        // NAMED, not "something went wrong": a blocked camera and a device
        // without one need different things from the person reading it.
        setDenied(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera access is off for this site. Pick a photo instead, or allow it in your browser settings.'
            : e instanceof Error
              ? e.message
              : 'Could not open the camera.',
        )
      }
    })()
    return () => {
      alive = false
      stop()
    }
  }, [facing, stop])

  const shoot = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return
    // The front camera is shown mirrored (that is what people expect of a
    // viewfinder), so the captured frame has to be mirrored back or the photo
    // does not match what they were looking at.
    if (facing === 'user') {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)
    c.toBlob((blob) => {
      if (!blob) return
      stop()
      onPick(new File([blob], 'capture.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex items-center px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 place-items-center rounded-full text-white/90 hover:bg-white/10"
        >
          <X size={20} aria-hidden />
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          aria-label="Switch camera"
          className="grid size-9 place-items-center rounded-full text-white/90 hover:bg-white/10"
        >
          <RefreshCw size={18} aria-hidden />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {denied ? (
          <div className="grid size-full place-items-center px-8 text-center">
            <div>
              <Camera size={26} className="mx-auto text-white/50" aria-hidden />
              <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">{denied}</p>
            </div>
          </div>
        ) : (
          <video
            ref={video}
            playsInline
            muted
            className={cn(
              'size-full object-cover transition-opacity duration-300',
              ready ? 'opacity-100' : 'opacity-0',
              facing === 'user' && 'scale-x-[-1]',
            )}
          />
        )}
      </div>

      {/* Shutter row: gallery left, shutter centre. */}
      <div className="flex items-center justify-between px-8 py-5">
        <label
          className="grid size-11 cursor-pointer place-items-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25"
          title="Choose from your photos"
        >
          <ImageIcon size={19} aria-hidden />
          <span className="sr-only">Choose a photo</span>
          <input
            type="file"
            accept={IMAGE_ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                stop()
                onPick(f)
              }
            }}
          />
        </label>

        <button
          type="button"
          onClick={shoot}
          disabled={!ready}
          aria-label="Take a photo"
          className="grid size-[70px] place-items-center rounded-full border-[5px] border-white bg-white/25 transition-transform duration-150 active:scale-95 disabled:opacity-40"
        >
          <span className="size-[52px] rounded-full bg-white" />
        </button>

        <span className="size-11" />
      </div>

      {/* POST | STORY, where the reference puts it. */}
      <div className="flex items-center justify-center gap-8 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {(['post', 'story'] as CaptureMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            className={cn(
              'text-[13px] font-semibold tracking-wide uppercase transition-colors duration-150',
              mode === m ? 'text-white' : 'text-white/45',
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
