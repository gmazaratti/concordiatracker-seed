import { useState } from 'react'
import { Bell, Check, Loader2, Send } from 'lucide-react'
import {
  enablePush,
  isPushSupported,
  notificationPermission,
  sendTestNotification,
} from '@/lib/push'
import { isIOS, isStandalone } from '@/lib/pwa-install'
import { cn } from '@/lib/cn'
import { Group, Row } from '../controls'

type Busy = 'enable' | 'test' | null

/** Real Web Push controls: opt in on this device, then fire a test notification.
 * On iOS this only works inside the home-screen-installed PWA (iOS 16.4+). */
export function PushControl() {
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    notificationPermission(),
  )
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const iosNeedsInstall = isIOS() && !isStandalone()
  const granted = perm === 'granted'

  async function onEnable() {
    setBusy('enable')
    setNote(null)
    const r = await enablePush()
    setPerm(notificationPermission())
    setBusy(null)
    if (r.ok) setNote({ tone: 'ok', text: 'Notifications are on for this device.' })
    else if (r.reason === 'denied')
      setNote({ tone: 'err', text: 'Permission was blocked — turn it on in your device settings.' })
    else if (r.reason === 'unsupported')
      setNote({ tone: 'err', text: 'This browser can’t receive push notifications.' })
    else setNote({ tone: 'err', text: 'Couldn’t enable notifications. Try again.' })
  }

  async function onTest() {
    setBusy('test')
    setNote(null)
    const r = await sendTestNotification()
    setBusy(null)
    setNote(
      r.ok
        ? { tone: 'ok', text: 'Sent — it should arrive in a moment.' }
        : { tone: 'err', text: r.error || 'Could not send the test.' },
    )
  }

  return (
    <Group label="Push notifications">
      {iosNeedsInstall ? (
        <Row
          label="Add to your home screen first"
          description="On iPhone, push only works from the installed app — tap Share → Add to Home Screen, then open it from there."
        />
      ) : !isPushSupported() ? (
        <Row
          label="Not supported here"
          description="This browser doesn’t support push notifications."
        />
      ) : (
        <>
          <Row
            label="Notifications on this device"
            description="Get deadline reminders and alerts even when the app is closed."
          >
            {granted ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success">
                <Check size={14} aria-hidden />
                Enabled
              </span>
            ) : (
              <button
                type="button"
                onClick={onEnable}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
              >
                {busy === 'enable' ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Bell size={14} aria-hidden />
                )}
                Enable
              </button>
            )}
          </Row>

          <Row
            label="Send a test notification"
            description="Fires a push to this device to confirm everything works."
          >
            <button
              type="button"
              onClick={onTest}
              disabled={!granted || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-fg transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50"
            >
              {busy === 'test' ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Send size={14} aria-hidden />
              )}
              Send test
            </button>
          </Row>
        </>
      )}

      {note && (
        <div className="px-4 py-3">
          <p className={cn('text-[12px]', note.tone === 'ok' ? 'text-success' : 'text-danger')}>
            {note.text}
          </p>
        </div>
      )}
    </Group>
  )
}
