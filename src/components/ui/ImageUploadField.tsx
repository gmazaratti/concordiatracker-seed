import { useRef, useState } from 'react'
import { Crop, ImageIcon, Link2, Loader2, Upload } from 'lucide-react'
import { IMAGE_ACCEPT_ATTR, uploadOrgImage, type ImageKind } from '@/lib/imageUpload'
import { IMAGE_SPECS, type CropKind } from '@/lib/image-crop'
import { FallbackImg } from './FallbackImg'
import { ImageCropper } from './ImageCropper'
import { InfoHint } from './InfoHint'
import { Button } from './Button'
import { cn } from '@/lib/cn'

/** The crop presets map onto the upload buckets; an event banner is stored at
 *  banner size and only differs in the shape it is cropped to. */
const UPLOAD_KIND: Record<CropKind, ImageKind> = {
  logo: 'logo',
  banner: 'banner',
  eventBanner: 'banner',
}

/**
 * Choose a picture, place it, and see it — in that order.
 *
 * FOUR WAYS IN, because people arrive with the file in different places: the
 * Upload button, a drag onto the field, a paste of a URL, and nothing at all
 * (the branded initials are a real answer, not a gap, so no club is blocked on
 * finding a logo before it can finish setting up).
 *
 * PLACEMENT HAPPENS BEFORE THE PREVIEW. A chosen file opens the cropper
 * immediately rather than being centre-cropped and shown, because "that is not
 * the part of my banner I wanted" is a thing you learn by looking, and the
 * previous flow gave you the look only after it had already decided for you.
 * Adjust re-opens it, so the decision is never final.
 */
export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  kind,
}: {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
  kind: CropKind
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showUrl, setShowUrl] = useState(false)
  const [dropping, setDropping] = useState(false)
  /** The file (or existing URL) currently being positioned. */
  const [cropping, setCropping] = useState<File | string | null>(null)
  const spec = IMAGE_SPECS[kind]
  const wide = kind !== 'logo'

  function take(file: File | undefined | null) {
    if (!file) return
    setErr('')
    if (!file.type.startsWith('image/')) {
      setErr('Choose a PNG, JPG, WEBP, or GIF image.')
      return
    }
    setCropping(file)
  }

  async function upload(file: File) {
    setBusy(true)
    try {
      const url = await uploadOrgImage(file, UPLOAD_KIND[kind])
      onChange(url)
      setCropping(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.')
      setCropping(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDropping(false)
        take(e.dataTransfer.files?.[0])
      }}
      className={cn(
        'rounded-xl transition-colors duration-150',
        dropping && 'bg-accent-soft outline-2 outline-dashed outline-accent',
      )}
    >
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <InfoHint label={`${label} size`}>
          <p className="text-[12.5px] font-medium text-fg">Recommended: {spec.recommended}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{spec.note}</p>
          <p className="mt-1.5 text-[11.5px] text-subtle">
            Anything else works too — you position it after choosing, and we save it at this size.
          </p>
        </InfoHint>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'relative shrink-0 overflow-hidden border border-border bg-surface-2',
            wide ? 'h-12 w-24 rounded-lg' : 'size-12 rounded-full',
          )}
        >
          <span className="grid size-full place-items-center text-subtle">
            <ImageIcon size={16} aria-hidden />
          </span>
          <FallbackImg src={value} className="absolute inset-0 size-full object-cover" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Upload size={14} aria-hidden />
              )}
              {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            </Button>
            {value && !busy && (
              <button
                type="button"
                onClick={() => setCropping(value)}
                className="inline-flex items-center gap-1 text-[12px] text-subtle transition-colors hover:text-fg"
              >
                <Crop size={12} aria-hidden />
                Adjust
              </button>
            )}
            {value && !busy && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-[12px] text-subtle transition-colors hover:text-danger"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUrl((s) => !s)}
              className="inline-flex items-center gap-1 text-[12px] text-subtle transition-colors hover:text-fg"
            >
              <Link2 size={12} aria-hidden />
              or paste a URL
            </button>
          </div>
          <p className="mt-1 hidden text-[11px] text-subtle sm:block">
            Or drop an image here.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = '' // so the same file can be picked twice
              take(f)
            }}
          />
        </div>
      </div>

      {showUrl && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      )}
      {err && <p className="mt-1.5 text-[12px] text-danger">{err}</p>}

      {cropping && (
        <ImageCropper
          file={cropping}
          kind={kind}
          busy={busy}
          onCancel={() => setCropping(null)}
          onDone={(f) => void upload(f)}
        />
      )}
    </div>
  )
}
