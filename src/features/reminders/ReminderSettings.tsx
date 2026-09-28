import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Group, Row, Segmented, Switch } from '@/features/settings/controls'
import { leadLabel, MAX_REMINDER_MINUTES, REMINDER_PRESETS, reminderCopy } from '@/lib/reminder-copy'
import { reminderPermission, requestReminderPermission } from '@/lib/assignment-reminders'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { LIVE_WINDOW_CHOICES, useReminderPrefs } from './useReminderPrefs'

/**
 * Settings → Assignment reminders.
 *
 * The master switch, the default lead times every assignment gets (each one can
 * add its own on top, in its editor), the voice, and on iPhone the Live
 * Activity. Everything is stored on the profile so the phone and the browser
 * agree; on the phone the notifications are scheduled locally.
 */
export function ReminderSettings() {
  const [prefs, update] = useReminderPrefs()
  const native = Capacitor.isNativePlatform()
  const [perm, setPerm] = useState<'granted' | 'denied' | 'prompt' | 'unavailable'>('unavailable')
  const [custom, setCustom] = useState('')
  const [customUnit, setCustomUnit] = useState<'60' | '1440'>('60')
  const [tested, setTested] = useState(false)

  useEffect(() => {
    let live = true
    void reminderPermission().then((p) => {
      if (live) setPerm(p)
    })
    return () => {
      live = false
    }
  }, [])

  async function setEnabled(on: boolean) {
    update({ enabled: on })
    // Asked here, in context, the moment it is needed; never at launch.
    if (on && native) setPerm(await requestReminderPermission())
  }

  function toggleDefault(m: number) {
    haptic('select')
    const has = prefs.defaults.includes(m)
    update({ defaults: has ? prefs.defaults.filter((x) => x !== m) : [...prefs.defaults, m].sort((a, b) => b - a) })
  }

  const customMinutes = Math.round(Number(custom) * Number(customUnit))
  const customOk = Number(custom) > 0 && customMinutes <= MAX_REMINDER_MINUTES && !prefs.defaults.includes(customMinutes)
  const extras = prefs.defaults.filter((m) => !REMINDER_PRESETS.includes(m))
  const sample = reminderCopy({ tone: prefs.tone, title: 'Assignment 1', course: 'COMM 305', offsetMinutes: 60, seed: 'sample' })

  async function sendTest() {
    if (!native) return
    if ((await requestReminderPermission()) !== 'granted') return
    const words = reminderCopy({
      tone: prefs.tone,
      title: 'Assignment 1',
      course: 'COMM 305',
      offsetMinutes: 60,
      seed: String(Date.now()),
    })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999_000 + Math.floor(Math.random() * 999),
          title: words.title,
          body: words.body,
          schedule: { at: new Date(Date.now() + 60_000), allowWhileIdle: true },
          extra: { kind: 'test', path: '/app' },
        },
      ],
    })
    setTested(true)
  }

  return (
    <Group label="Assignment reminders">
      <Row label="Remind me before assignments are due" description="Every dated assignment, on this phone and in your browser.">
        <Switch checked={prefs.enabled} onChange={(on) => void setEnabled(on)} label="Assignment reminders" />
      </Row>

      {native && prefs.enabled && perm !== 'granted' && perm !== 'unavailable' && (
        <div className="px-4 pb-3 text-[12.5px] text-warning">
          {perm === 'denied' ? (
            'Notifications are off for ConcordiaTracker. Turn them on in Settings › Notifications.'
          ) : (
            <button type="button" onClick={() => void setEnabled(true)} className="min-h-11 font-medium underline">
              Allow notifications on this phone
            </button>
          )}
        </div>
      )}

      <Row
        label="Default reminders"
        description="Applied to every assignment. Add more to one assignment from its editor; they combine."
        stacked
      >
        <div className={cn('flex flex-wrap gap-1.5', !prefs.enabled && 'opacity-60')}>
          {[...REMINDER_PRESETS, ...extras].sort((a, b) => b - a).map((m) => {
            const on = prefs.defaults.includes(m)
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDefault(m)}
                className={cn(
                  'min-h-9 rounded-full border px-3 text-[12.5px] transition-colors',
                  on ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-border text-muted hover:text-fg',
                )}
              >
                {leadLabel(m)}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            inputMode="numeric"
            placeholder="4"
            aria-label="Custom default reminder"
            className="w-16 rounded-lg border border-border bg-canvas px-2 py-1.5 text-center text-[13px] text-fg outline-none focus:border-border-strong"
          />
          <Segmented
            ariaLabel="Unit"
            value={customUnit}
            onChange={setCustomUnit}
            options={[
              { value: '60', label: 'hours' },
              { value: '1440', label: 'days' },
            ]}
          />
          <button
            type="button"
            disabled={!customOk}
            onClick={() => {
              toggleDefault(customMinutes)
              setCustom('')
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-[12.5px] font-medium text-fg disabled:opacity-50"
          >
            <Plus size={13} aria-hidden /> Add
          </button>
        </div>
      </Row>

      <Row label="Voice" description="How the reminders talk to you." stacked>
        <Segmented
          ariaLabel="Reminder voice"
          value={prefs.tone}
          onChange={(tone) => update({ tone })}
          options={[
            { value: 'cool', label: 'Cool' },
            { value: 'formal', label: 'Formal' },
          ]}
        />
        <div className="mt-2 rounded-xl border border-border bg-canvas px-3 py-2.5">
          <p className="text-[12.5px] font-semibold text-fg">{sample.title}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">{sample.body}</p>
        </div>
        {native && (
          <button
            type="button"
            onClick={() => void sendTest()}
            className="mt-2 min-h-11 text-[12.5px] font-medium text-accent"
          >
            {tested ? 'Test scheduled: lock your phone and wait a minute' : 'Send me a test in one minute'}
          </button>
        )}
      </Row>

      {native && (
        <Row
          label="Live Activity"
          description="The next assignment due, with a live countdown, on your Lock Screen and in the Dynamic Island."
          stacked
        >
          <div className="flex flex-wrap items-center gap-3">
            <Switch checked={prefs.liveActivity} onChange={(on) => update({ liveActivity: on })} label="Live Activity" />
            {prefs.liveActivity && (
              <Segmented
                ariaLabel="Start the Live Activity"
                value={String(prefs.liveWindowHours)}
                onChange={(v) => update({ liveWindowHours: Number(v) })}
                options={LIVE_WINDOW_CHOICES.map((h) => ({ value: String(h), label: `${h}h before` }))}
              />
            )}
          </div>
        </Row>
      )}
    </Group>
  )
}
