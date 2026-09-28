import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, Lock, Trash2 } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { useAppData } from '@/app/providers/app-data'
import { useTheme } from '@/app/providers/theme'
import { useSettings } from '@/app/providers/settings'
import { IMAGE_ACCEPT_ATTR, uploadWallpaper } from '@/lib/imageUpload'
import { cn } from '@/lib/cn'
import {
  WALLPAPER_TEMPLATES,
  removeWallpaperFile,
  signedWallpaperUrl,
  type WallpaperTemplate,
} from './wallpaper'

/**
 * Settings → General → Wallpaper, under Theme.
 *
 * Templates set a theme AND a photo together; an upload is your own photo on
 * whatever theme you have. Semester pass: a free account sees the section
 * locked, and the bucket refuses its uploads anyway (db/wallpapers.sql).
 * One uploaded file per account: replacing or removing it deletes the old one.
 */
export function WallpaperSection() {
  const { uiState, patchUiState } = useUiState()
  const { plan } = useAppData()
  const { setTheme, setCustom } = useTheme()
  const { openSettings } = useSettings()
  const pro = plan === 'semester'
  const bg = uiState.todayBackground
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // A thumbnail for an uploaded wallpaper (private bucket → signed link).
  const thumbKey = bg?.path ? `${bg.path}#${bg.v ?? 0}` : null
  const [thumb, setThumb] = useState<{ key: string; url: string | null } | null>(null)
  useEffect(() => {
    const path = bg?.path
    if (!path || !thumbKey) return
    let live = true
    void signedWallpaperUrl(path, bg?.v ?? 0).then((url) => live && setThumb({ key: thumbKey, url }))
    return () => {
      live = false
    }
  }, [bg?.path, bg?.v, thumbKey])
  const uploadedThumb = thumbKey && thumb?.key === thumbKey ? thumb.url : null

  const locked = () => openSettings('billing')

  const applyTemplate = (t: WallpaperTemplate) => {
    if (!pro) return locked()
    if (t.custom) setCustom(t.custom)
    setTheme(t.theme)
    removeWallpaperFile(bg?.path)
    patchUiState({ todayBackground: { preset: t.id, dim: t.dim } })
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      // Same path every time (it overwrites), so nothing old to delete.
      const path = await uploadWallpaper(file)
      patchUiState({ todayBackground: { path, v: Date.now(), dim: bg?.dim ?? 40 } })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = () => {
    removeWallpaperFile(bg?.path)
    patchUiState({ todayBackground: undefined })
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {WALLPAPER_TEMPLATES.map((t) => {
          const active = bg?.preset === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              aria-pressed={active}
              aria-label={pro ? `Use ${t.name}` : `${t.name} (included with the Semester pass)`}
              className={cn(
                'group relative overflow-hidden rounded-xl border text-left transition-colors duration-150',
                active ? 'border-accent' : 'border-border hover:border-border-strong',
              )}
            >
              <span
                className={cn('block h-20 bg-cover bg-center', !pro && 'opacity-60')}
                style={{ backgroundImage: `url("${t.src}")` }}
              />
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg">
                {!pro && <Lock size={11} className="text-subtle" aria-hidden />}
                {active && <Check size={12} className="text-accent" aria-hidden />}
                {t.name}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          disabled={busy}
          onClick={() => (pro ? input.current?.click() : locked())}
          aria-pressed={!!bg?.path}
          className={cn(
            'relative overflow-hidden rounded-xl border text-left transition-colors duration-150 disabled:opacity-60',
            bg?.path ? 'border-accent' : 'border-dashed border-border-strong hover:border-accent/60',
          )}
        >
          <span
            className="grid h-20 place-items-center bg-surface-2 bg-cover bg-center text-subtle"
            style={uploadedThumb ? { backgroundImage: `url("${uploadedThumb}")` } : undefined}
          >
            {!uploadedThumb && <ImagePlus size={18} aria-hidden />}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg">
            {!pro && <Lock size={11} className="text-subtle" aria-hidden />}
            {busy ? 'Uploading…' : bg?.path ? 'Your photo · change' : 'Your own photo'}
          </span>
        </button>
      </div>

      <input
        ref={input}
        id="wallpaper-file"
        type="file"
        accept={IMAGE_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />

      {bg && pro && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-muted">
          <label htmlFor="wallpaper-dim" className="w-20 shrink-0">
            Dim photo
          </label>
          <input
            id="wallpaper-dim"
            type="range"
            min={0}
            max={90}
            step={5}
            value={bg.dim}
            onChange={(e) => patchUiState({ todayBackground: { ...bg, dim: Number(e.target.value) } })}
            className="ct-range min-w-0 flex-1"
          />
          <span className="w-9 shrink-0 text-right tabular-nums">{bg.dim}%</span>
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-subtle transition-colors hover:bg-danger/15 hover:text-danger"
          >
            <Trash2 size={13} aria-hidden />
            Remove
          </button>
        </div>
      )}

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-subtle">
        {pro
          ? 'Shows behind Today, Courses and Calendar, never the sidebar. Templates set a matching theme too. Your own photo: PNG, JPG or WEBP up to 8 MB, kept private to your account.'
          : 'Wallpapers come with the Semester pass: a template or your own photo behind Today, Courses and Calendar.'}
      </p>
      {error && (
        <p className="mt-2 text-[12px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
