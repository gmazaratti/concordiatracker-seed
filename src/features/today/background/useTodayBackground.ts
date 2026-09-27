import { useEffect } from 'react'

/**
 * Paint a photo behind Today, and only Today.
 *
 * It goes on `#app-main`, the app's scroll container, which is exactly "the
 * page and not the sidebar". And on a scroll container the default
 * `background-attachment: scroll` pins the image to the container's box, so
 * the cards scroll over a still photo instead of the photo scrolling away.
 *
 * The page colour is laid over the photo at `dim` percent. Cards are opaque
 * surfaces and read fine on anything, but the greeting and section labels sit
 * straight on the background, and on a busy photo they would not. The overlay
 * is the page's own token, so it follows the theme and a custom page colour.
 *
 * Removed when you leave Today or clear the setting.
 */
export function useTodayBackground(bg: { url: string; dim: number } | undefined): void {
  const url = bg?.url
  const dim = Math.min(90, Math.max(0, bg?.dim ?? 55))

  useEffect(() => {
    const main = document.getElementById('app-main')
    if (!main || !url) return
    const wash = `color-mix(in srgb, var(--ct-canvas) ${dim}%, transparent)`
    main.style.backgroundImage = `linear-gradient(${wash}, ${wash}), url("${encodeURI(url)}")`
    main.style.backgroundSize = 'cover'
    main.style.backgroundPosition = 'center'
    main.style.backgroundRepeat = 'no-repeat'
    return () => {
      main.style.backgroundImage = ''
      main.style.backgroundSize = ''
      main.style.backgroundPosition = ''
      main.style.backgroundRepeat = ''
    }
  }, [url, dim])
}
