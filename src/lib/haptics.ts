import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * A tap you can feel, for the moments that deserve one: ticking something off,
 * a message arriving, a swipe committing.
 *
 * In the App Store app this is the Taptic Engine (@capacitor/haptics). In a
 * browser it falls back to `navigator.vibrate`, which Android honours and
 * Safari ignores; see the note on `buzz` in lib/message-alerts.
 *
 * Deliberately few kinds. Haptics that fire on everything stop meaning
 * anything, the same way a notification for everything does.
 */
export type HapticKind = 'tap' | 'success' | 'warning'

export function haptic(kind: HapticKind = 'tap'): void {
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'tap') void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      else
        void Haptics.notification({
          type: kind === 'success' ? NotificationType.Success : NotificationType.Warning,
        }).catch(() => {})
      return
    }
    navigator.vibrate?.(kind === 'tap' ? 10 : 30)
  } catch {
    /* refused by the platform; a missing buzz is not worth an error */
  }
}
