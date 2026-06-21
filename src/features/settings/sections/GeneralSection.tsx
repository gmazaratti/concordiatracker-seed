import { useEffect, useRef, useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { useUpdates } from '@/app/providers/updates'
import { useCommandPalette } from '@/app/providers/command-palette'
import { DEFAULT_SHORTCUT, formatShortcut } from '@/app/providers/command-palette'
import { cn } from '@/lib/cn'
import { Group, Row, Switch, Segmented } from '../controls'
import { PushControl } from './PushControl'

type Lang = 'en' | 'fr'

/** General: appearance, lightweight preferences, notifications, updates, and the
 * English/French toggle (i18n stubbed — full translation lands later). */
export function GeneralSection() {
  const { currentVersion, showIndicator, notificationsEnabled, setNotificationsEnabled, openHistory } =
    useUpdates()
  const [reducedMotion, setReducedMotion] = useState(false)
  const [weekStartMon, setWeekStartMon] = useState(true)
  const [deadlineReminders, setDeadlineReminders] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [productUpdates, setProductUpdates] = useState(false)
  const [lang, setLang] = useState<Lang>('en')

  return (
    <div>
      <Group label="Appearance">
        <Row label="Theme" description="Swaps the whole product from one token set." stacked>
          <ThemeSwitcher />
        </Row>
      </Group>

      <Group label="Preferences">
        <Row label="Reduce motion" description="Minimize non-essential animation.">
          <Switch checked={reducedMotion} onChange={setReducedMotion} label="Reduce motion" />
        </Row>
        <Row label="Start week on Monday" description="Used across the calendar.">
          <Switch checked={weekStartMon} onChange={setWeekStartMon} label="Start week on Monday" />
        </Row>
      </Group>

      <PushControl />

      <Group label="Email">
        <Row label="Deadline reminders" description="A nudge before things are due.">
          <Switch checked={deadlineReminders} onChange={setDeadlineReminders} label="Deadline reminders" />
        </Row>
        <Row label="Weekly digest email" description="A Monday summary of the week ahead.">
          <Switch checked={weeklyDigest} onChange={setWeeklyDigest} label="Weekly digest email" />
        </Row>
        <Row label="Product updates" description="Occasional notes on what's new.">
          <Switch checked={productUpdates} onChange={setProductUpdates} label="Product updates" />
        </Row>
      </Group>

      <Group label="Updates">
        <Row
          label="What's new"
          description="See what changed in each release."
        >
          <button
            type="button"
            onClick={openHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-fg transition-colors duration-150 hover:bg-surface-2"
          >
            <span className="tabular-nums">v{currentVersion}</span>
            {showIndicator && <span className="size-1.5 rounded-full bg-accent" aria-hidden />}
            <ChevronRight size={14} className="text-subtle" aria-hidden />
          </button>
        </Row>
        <Row
          label="Show update notifications"
          description="A toast and a dot when a new version ships."
        >
          <Switch
            checked={notificationsEnabled}
            onChange={setNotificationsEnabled}
            label="Show update notifications"
          />
        </Row>
      </Group>

      <Group label="Keyboard">
        <Row
          label="Command palette shortcut"
          description="Opens the search & command palette from anywhere."
        >
          <ShortcutControl />
        </Row>
      </Group>

      <Group label="Language">
        <Row
          label="Interface language"
          description={
            lang === 'fr'
              ? 'Traduction en cours — l’interface reste en anglais pour l’instant.'
              : 'French is stubbed — full translation comes later.'
          }
          stacked
        >
          <Segmented<Lang>
            ariaLabel="Interface language"
            value={lang}
            onChange={setLang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
            ]}
          />
        </Row>
      </Group>
    </div>
  )
}

/** A click-to-record control for the command-palette shortcut. Clicking arms
 * capture (handled globally in CommandPaletteProvider) so the very next ⌘/Ctrl
 * combo is recorded; Escape cancels. A reset returns it to the default. */
function ShortcutControl() {
  const { shortcut, setShortcut, beginCapture } = useCommandPalette()
  const [capturing, setCapturing] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)

  function start() {
    if (capturing) {
      cancelRef.current?.()
      cancelRef.current = null
      setCapturing(false)
      return
    }
    setCapturing(true)
    cancelRef.current = beginCapture((s) => {
      cancelRef.current = null
      setCapturing(false)
      if (s) setShortcut(s)
    })
  }

  // Cancel an in-flight capture if the panel unmounts.
  useEffect(() => () => cancelRef.current?.(), [])

  const isDefault =
    shortcut.key === DEFAULT_SHORTCUT.key && shortcut.shift === DEFAULT_SHORTCUT.shift

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={start}
        aria-label="Change command palette shortcut"
        className={cn(
          'inline-flex min-w-[7rem] items-center justify-center rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
          capturing
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-border bg-surface text-fg hover:bg-surface-2',
        )}
      >
        {capturing ? 'Press keys… (Esc)' : <span className="tabular-nums">{formatShortcut(shortcut)}</span>}
      </button>
      {!isDefault && !capturing && (
        <button
          type="button"
          onClick={() => setShortcut(DEFAULT_SHORTCUT)}
          aria-label="Reset shortcut to default"
          title="Reset to default"
          className="inline-flex size-7 items-center justify-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <RotateCcw size={13} aria-hidden />
        </button>
      )}
    </div>
  )
}
