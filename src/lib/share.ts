import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

/**
 * The system share sheet, where there is one.
 *
 * In the App Store app: iOS's own sheet (Messages, AirDrop, Instagram…) through
 * @capacitor/share. In a browser: the Web Share API where it exists (Safari,
 * Chrome on Android). Where neither exists (most desktops) `canShare()` is
 * false and callers keep their copy-link button as the only way, rather than
 * showing a Share button that does nothing.
 */
export function canShare(): boolean {
  try {
    return Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && 'share' in navigator)
  } catch {
    return false
  }
}

/** Resolves true when the sheet opened; false when it could not (or was closed). */
export async function shareLink(opts: { title: string; text?: string; url: string }): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title })
      return true
    }
    if ('share' in navigator) {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url })
      return true
    }
  } catch {
    /* dismissed, or refused: the copy button is still there */
  }
  return false
}
