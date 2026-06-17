import { useState } from 'react'
import { Check, RefreshCw, Sparkles } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useSettings } from '@/app/providers/settings'
import { UpgradeChip } from '@/components/UpgradeChip'
import { Switch } from '@/features/settings/controls'
import { ACADEMIC_META } from './calendar'
import { cn } from '@/lib/cn'

/** The calendar rail: independent layer toggles, a compact legend, and the
 * Pro-gated calendar-sync stub. Mirrors Today's recessed glance-panel language. */
export function CalendarRail() {
  const { plan, calendarPrefs, updateCalendarPrefs } = useAppData()

  return (
    <div className="flex flex-col gap-3">
      <Panel title="Layers">
        <LayerRow
          label="My calendar"
          hint="Assignments + tasks"
          dot={<span className="size-2.5 rounded-full bg-subtle" aria-hidden />}
          checked={calendarPrefs.showMine}
          onChange={(v) => updateCalendarPrefs({ showMine: v })}
        />
        <LayerRow
          label="Concordia"
          hint="Official academic dates"
          dot={<span className="size-2.5 rounded-full bg-info" aria-hidden />}
          checked={calendarPrefs.showConcordia}
          onChange={(v) => updateCalendarPrefs({ showConcordia: v })}
        />
      </Panel>

      <Panel title="University dates">
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 px-3.5 py-3">
          {Object.values(ACADEMIC_META).map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-1.5 text-[12px] text-muted">
              <Icon size={13} className="shrink-0 text-info" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </Panel>

      <SyncButton pro={plan === 'semester'} />
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-surface/50">
      <p className="border-b border-border/60 px-3.5 py-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {title}
      </p>
      {children}
    </div>
  )
}

function LayerRow({
  label,
  hint,
  dot,
  checked,
  onChange,
}: {
  label: string
  hint: string
  dot: React.ReactNode
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <span className="flex items-center gap-2.5">
        {dot}
        <span>
          <span className="block text-[13px] font-medium text-fg">{label}</span>
          <span className="block text-[11px] text-subtle">{hint}</span>
        </span>
      </span>
      <Switch checked={checked} onChange={onChange} label={`Toggle ${label} layer`} />
    </div>
  )
}

function SyncButton({ pro }: { pro: boolean }) {
  const { openSettings } = useSettings()
  const [synced, setSynced] = useState(false)

  if (!pro) {
    return (
      <>
        <UpgradeChip
          icon={RefreshCw}
          label="Sync your calendar"
          onClick={() => openSettings('billing')}
          className="sm:hidden"
        />
        <button
          type="button"
          onClick={() => openSettings('billing')}
          className="group hidden w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-3 text-left transition-colors duration-150 hover:border-accent/50 sm:flex"
        >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <RefreshCw size={17} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-fg">Sync your calendar</span>
          <span className="block text-[12px] text-muted">
            Google / Apple · <span className="text-accent">Semester pass</span>
          </span>
        </span>
        <Sparkles size={15} className="shrink-0 text-accent" aria-hidden />
        </button>
      </>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setSynced(true)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-150',
        synced
          ? 'border-success/40 bg-success/10'
          : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          synced ? 'bg-success/15 text-success' : 'bg-surface-2 text-fg',
        )}
      >
        {synced ? <Check size={17} aria-hidden /> : <RefreshCw size={17} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-fg">
          {synced ? 'Sync set up' : 'Sync to Google / Apple'}
        </span>
        <span className="block text-[12px] text-muted">
          {synced ? 'Two-way sync coming soon' : 'Push deadlines to your calendar'}
        </span>
      </span>
    </button>
  )
}
