import type { TodayPrefs } from '@/app/providers/app-data'
import { Switch, Segmented } from '@/features/settings/controls'

/** The "Customize Today" panel — a small, deliberately short set of toggles that
 * tailor the calm default without rebuilding the screen. Rendered inline in the
 * Due card (not an absolute popover) so the list Card's clip never crops it. */
export function CustomizeToday({
  prefs,
  onChange,
}: {
  prefs: TodayPrefs
  onChange: (patch: Partial<TodayPrefs>) => void
}) {
  return (
    <div className="ct-animate-fade border-b border-border bg-surface-2/30 px-4 py-3">
      <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        <Line label="Show weight %">
          <Switch
            label="Show weight on Today"
            checked={prefs.showWeight}
            onChange={(v) => onChange({ showWeight: v })}
          />
        </Line>

        <Line label="Show provenance">
          <Switch
            label="Show provenance on Today"
            checked={prefs.showProvenance}
            onChange={(v) => onChange({ showProvenance: v })}
          />
        </Line>

        <Line label="Density">
          <Segmented<TodayPrefs['density']>
            ariaLabel="Row density"
            value={prefs.density}
            onChange={(density) => onChange({ density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </Line>

        <Line label="Group by">
          <Segmented<TodayPrefs['groupBy']>
            ariaLabel="Group the due list by"
            value={prefs.groupBy}
            onChange={(groupBy) => onChange({ groupBy })}
            options={[
              { value: 'time', label: 'Time' },
              { value: 'course', label: 'Course' },
            ]}
          />
        </Line>
      </div>
    </div>
  )
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted">{label}</span>
      {children}
    </div>
  )
}
