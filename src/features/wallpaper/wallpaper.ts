import { supabase } from '@/lib/supabase'
import type { CustomTheme, Theme } from '@/app/providers/theme'

export type Wallpaper = { preset?: string; path?: string; v?: number; url?: string; dim: number }

/**
 * Built-in wallpapers that come with a look: applying one sets the theme too,
 * because a photo and a palette chosen separately rarely agree.
 *
 * The images ship with the app (public/wallpapers), so they cost no storage
 * and load from the same CDN as everything else.
 */
export interface WallpaperTemplate {
  id: string
  name: string
  description: string
  src: string
  /** How much of the page colour sits over the photo. */
  dim: number
  theme: Theme
  /** Set when `theme` is 'custom'. */
  custom?: CustomTheme
}

export const WALLPAPER_TEMPLATES: WallpaperTemplate[] = [
  {
    id: 'hearts',
    name: 'Pink hearts',
    description: 'Light Rose with soft hearts and warm lights.',
    src: '/wallpapers/hearts.jpg',
    dim: 30,
    theme: 'rose',
  },
  {
    id: 'blue-lines',
    name: 'Blue lines',
    description: 'A dark theme in blue, over glowing diagonals.',
    src: '/wallpapers/blue-lines.jpg',
    dim: 35,
    theme: 'custom',
    custom: { base: 'dark', accent: '#3b82f6' },
  },
]

export function templateById(id: string | undefined): WallpaperTemplate | undefined {
  return WALLPAPER_TEMPLATES.find((t) => t.id === id)
}

/*
 * Signed links for uploaded wallpapers. The bucket is private, so the page
 * cannot hold a permanent URL; a link is minted for a week and cached for the
 * session, so switching between Today, Courses and Calendar never re-asks.
 */
const SIGNED_TTL = 60 * 60 * 24 * 7
const signed = new Map<string, Promise<string | null>>()

/** `v` is the upload's version: the path never changes (one file per
 *  account), so the version is what tells a new picture from a cached one. */
export function signedWallpaperUrl(path: string, v = 0): Promise<string | null> {
  const key = `${path}#${v}`
  let p = signed.get(key)
  if (!p) {
    p = supabase.storage
      .from('wallpapers')
      .createSignedUrl(path, SIGNED_TTL)
      .then(({ data }) => (data?.signedUrl ? `${data.signedUrl}&v=${v}` : null))
    signed.set(key, p)
  }
  return p
}

/** Delete an uploaded wallpaper file (own folder only; RLS enforces it). */
export function removeWallpaperFile(path: string | undefined): void {
  if (!path) return
  for (const k of signed.keys()) if (k.startsWith(`${path}#`)) signed.delete(k)
  void supabase.storage.from('wallpapers').remove([path])
}
