import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { supabase } from '@/lib/supabase'
import { IMAGE_ACCEPT_ATTR, uploadOrgImage } from '@/lib/imageUpload'

/**
 * Pick a photo for behind Today, and how much to dim it.
 *
 * TRIAL, admin-only for now (asked 2026-09-27: "a feature just for me to
 * test"). It rides the existing image pipeline: the photo is re-encoded
 * through a canvas (no EXIF, nothing but pixels), capped at 2400px on its long
 * edge, and stored in the student's own folder of the public media bucket.
 * The previous photo is deleted when it is replaced or removed, so each
 * account holds at most one.
 */
export function BackgroundSetting() {
  const { uiState, patchUiState } = useUiState()
  const bg = uiState.todayBackground
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const dropOld = (url: string | undefined) => {
    const path = url?.split('/org-media/')[1]
    if (path) void supabase.storage.from('org-media').remove([decodeURIComponent(path)])
  }

  const choose = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadOrgImage(file, 'background')
      dropOld(bg?.url)
      patchUiState({ todayBackground: { url, dim: bg?.dim ?? 55 } })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = () => {
    dropOld(bg?.url)
    patchUiState({ todayBackground: undefined })
  }

  return (
    <div className="mb-5 rounded-xl border border-border bg-canvas p-3">
      <div className="flex items-center gap-3">
        <div
          className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2 bg-cover bg-center"
          style={bg ? { backgroundImage: `url("${encodeURI(bg.url)}")` } : undefined}
          aria-hidden
        >
          {!bg && <ImagePlus size={16} className="text-subtle" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">
            Today background <span className="ml-1 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent uppercase">Trial</span>
          </p>
          <p className="text-[11.5px] leading-snug text-subtle">
            Behind Today only, never the sidebar. PNG, JPG or WEBP, up to 8 MB; stored at up to 2400px.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-lg border border-border-strong px-2.5 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {busy ? 'Uploading…' : bg ? 'Change' : 'Upload'}
          </button>
          {bg && (
            <button
              type="button"
              onClick={remove}
              aria-label="Remove background"
              className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-danger/15 hover:text-danger"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
        </div>
        <input
          ref={input}
          id="today-background-file"
          type="file"
          accept={IMAGE_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </div>

      {bg && (
        <label className="mt-3 flex items-center gap-3 text-[12px] text-muted">
          <span className="w-20 shrink-0">Dim photo</span>
          <input
            id="today-background-dim"
            type="range"
            min={0}
            max={90}
            step={5}
            value={bg.dim}
            onChange={(e) => patchUiState({ todayBackground: { ...bg, dim: Number(e.target.value) } })}
            className="ct-range min-w-0 flex-1"
          />
          <span className="w-9 shrink-0 text-right tabular-nums">{bg.dim}%</span>
        </label>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
