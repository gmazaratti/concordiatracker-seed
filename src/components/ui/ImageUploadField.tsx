import { useRef, useState } from 'react'
import { ImageIcon, Loader2, Upload } from 'lucide-react'
import { IMAGE_ACCEPT_ATTR, uploadOrgImage } from '@/lib/imageUpload'
import { Button } from './Button'
import { cn } from '@/lib/cn'

/**
 * Upload an image (or paste a URL) for an org logo/banner. Uploads go to the
 * public `org-media` bucket via `uploadOrgImage`, which re-encodes to a clean
 * raster WEBP (no script execution possible) and caps size. Keeps a URL fallback
 * so hosted images (ImgBB etc.) still work.
 */
export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  kind,
  shape = 'square',
}: {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
  kind: 'logo' | 'banner'
  shape?: 'square' | 'wide'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showUrl, setShowUrl] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setErr('')
    setBusy(true)
    try {
      const url = await uploadOrgImage(file, kind)
      onChange(url)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2',
            shape === 'wide' ? 'h-12 w-24' : 'size-12',
          )}
        >
          {value ? (
            <img
              src={value}
              alt=""
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
          ) : (
            <span className="grid size-full place-items-center text-subtle">
              <ImageIcon size={16} aria-hidden />
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
              {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            </Button>
            {value && !busy && (
              <button type="button" onClick={() => onChange('')} className="text-[12px] text-subtle transition-colors hover:text-danger">
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUrl((s) => !s)}
              className="text-[12px] text-subtle transition-colors hover:text-fg"
            >
              or paste a URL
            </button>
          </div>
          <input ref={inputRef} type="file" accept={IMAGE_ACCEPT_ATTR} className="hidden" onChange={onFile} />
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
    </div>
  )
}
