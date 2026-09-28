import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useUiState } from '@/app/providers/ui-state'
import { useAppData } from '@/app/providers/app-data'
import { signedWallpaperUrl, templateById } from './wallpaper'

/** Where a wallpaper shows: Today, Courses (list and every course), Calendar. */
function onWallpaperPage(pathname: string): boolean {
  return pathname === '/app' || pathname === '/app/' || /^\/app\/(courses|calendar)(\/|$)/.test(pathname)
}

/**
 * Paint the wallpaper behind the pages it belongs on.
 *
 * It goes on `#app-main`, the app's scroll container, which is exactly "the
 * page and not the sidebar". On a scroll container the default
 * `background-attachment: scroll` pins the image to the container's box, so
 * cards scroll over a still photo.
 *
 * The page colour is laid over the photo at `dim` percent: cards are opaque
 * and read on anything, but headings sit straight on the background. The
 * overlay is the page's own token, so it follows the theme.
 *
 * Pro only, checked against the plan the server reports. A free account that
 * writes a wallpaper into its own settings from the console gets nothing drawn
 * (and could not have uploaded one: the bucket refuses it).
 *
 * Mounted once, in the student layout, so it follows navigation.
 */
export function useWallpaper(): void {
  const { uiState } = useUiState()
  const { plan, dataLoading } = useAppData()
  const { pathname } = useLocation()
  const bg = uiState.todayBackground
  const pro = plan === 'semester'
  const show = !dataLoading && pro && !!bg && onWallpaperPage(pathname)

  // Resolve the image: a template's bundled file, the trial's public link, or
  // a signed link for an upload.
  const direct = templateById(bg?.preset)?.src ?? bg?.url ?? null
  const key = bg?.path ? `${bg.path}#${bg.v ?? 0}` : null
  const [signedFor, setSigned] = useState<{ key: string; url: string | null } | null>(null)
  useEffect(() => {
    const path = bg?.path
    if (!path || !key || direct) return
    let live = true
    void signedWallpaperUrl(path, bg?.v ?? 0).then((url) => live && setSigned({ key, url }))
    return () => {
      live = false
    }
  }, [bg?.path, bg?.v, key, direct])
  const src = direct ?? (signedFor && signedFor.key === key ? signedFor.url : null)
  const dim = Math.min(90, Math.max(0, bg?.dim ?? 40))

  useEffect(() => {
    const main = document.getElementById('app-main')
    if (!main || !show || !src) return
    const wash = `color-mix(in srgb, var(--ct-canvas) ${dim}%, transparent)`
    main.style.backgroundImage = `linear-gradient(${wash}, ${wash}), url("${encodeURI(src)}")`
    main.style.backgroundSize = 'cover'
    main.style.backgroundPosition = 'center'
    main.style.backgroundRepeat = 'no-repeat'
    return () => {
      main.style.backgroundImage = ''
      main.style.backgroundSize = ''
      main.style.backgroundPosition = ''
      main.style.backgroundRepeat = ''
    }
  }, [show, src, dim])
}
