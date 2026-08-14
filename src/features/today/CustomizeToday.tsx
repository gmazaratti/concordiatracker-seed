import type { TodayPrefs } from '@/app/providers/app-data'
import { Switch, Segmented } from '@/features/settings/controls'
import { useT } from '@/i18n/i18n'
import { WidgetGallery } from './widgets/WidgetGallery'
import type { WidgetContext } from './widgets/registry'

/** The "Customize Today" panel — a small, deliberately short set of toggles that
 * tailor the calm default without rebuilding the screen. Rendered inline in the
 * Due card (not an absolute popover) so the list Card's clip never crops it. */
export function CustomizeToday({
  prefs,
  onChange,
  widgets,
  onWidgetsChange,
  widgetCtx,
}: {
  widgets: string[]
  onWidgetsChange: (next: string[]) => void
  widgetCtx: WidgetContext
  prefs: TodayPrefs
  onChange: (patch: Partial<TodayPrefs>) => void
}) {
  const t = useT()
  return (
    <div className="ct-animate-fade border-b border-border bg-surface-2/30 px-4 py-3">
      <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        <Line label={t('today.showWeight')}>
          <Switch
            label={t('today.showWeightAria')}
            checked={prefs.showWeight}
            onChange={(v) => onChange({ showWeight: v })}
          />
        </Line>

        <Line label={t('today.showProvenance')}>
          <Switch
            label={t('today.showProvenanceAria')}
            checked={prefs.showProvenance}
            onChange={(v) => onChange({ showProvenance: v })}
          />
        </Line>

        <Line label={t('today.density')}>
          <Segmented<TodayPrefs['density']>
            ariaLabel={t('today.densityAria')}
            value={prefs.density}
            onChange={(density) => onChange({ density })}
            options={[
              { value: 'comfortable', label: t('today.comfortable') },
              { value: 'compact', label: t('today.compact') },
            ]}
          />
        </Line>

        <Line label={t('today.groupBy')}>
          <Segmented<TodayPrefs['groupBy']>
            ariaLabel={t('today.groupByAria')}
            value={prefs.groupBy}
            onChange={(groupBy) => onChange({ groupBy })}
            options={[
              { value: 'time', label: t('today.time') },
              { value: 'course', label: t('today.course') },
            ]}
          />
        </Line>
      </div>

      <div className="mt-4 border-t border-border/60 pt-3.5">
        <WidgetGallery layout={widgets} onChange={onWidgetsChange} ctx={widgetCtx} />
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
