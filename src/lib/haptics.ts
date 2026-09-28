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
export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error'

/**
 * The house rule, which is Apple's (HIG, "Playing haptics"):
 * - `tap`     light impact: a toggle flipped, a tab switched.
 * - `select`  selection tick: moving through a picker or a segmented control.
 * - `success` something finished: an assignment marked done, a save.
 * - `warning` about to lose something: a delete, a destructive confirm.
 * - `error`   it did not work.
 * Never on every tap; never as decoration.
 */
export function haptic(kind: HapticKind = 'tap'): void {
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'tap') void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      else if (kind === 'select') {
        void Haptics.selectionStart()
          .then(() => Haptics.selectionChanged())
          .then(() => Haptics.selectionEnd())
          .catch(() => {})
      } else {
        const type =
          kind === 'success' ? NotificationType.Success : kind === 'warning' ? NotificationType.Warning : NotificationType.Error
        void Haptics.notification({ type }).catch(() => {})
      }
      return
    }
    navigator.vibrate?.(kind === 'tap' || kind === 'select' ? 10 : 30)
  } catch {
    /* refused by the platform; a missing buzz is not worth an error */
  }
}
