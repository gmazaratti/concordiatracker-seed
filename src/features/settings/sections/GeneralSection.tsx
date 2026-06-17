import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { useUpdates } from '@/app/providers/updates'
import { Group, Row, Switch, Segmented } from '../controls'

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

      <Group label="Notifications">
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
