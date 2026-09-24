import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { ErrorState, Loading, Panel, RefreshButton, Stat } from '../admin-ui'
import { cn } from '@/lib/cn'
import { loadParseOverview, type ParseOverview } from './parse-data'
import { ago, pct, secs, withinDay } from './format'
import { ParseDailyChart } from './ParseDailyChart'
import { ParseBreakdowns } from './ParseBreakdowns'
import { ParseEventsList } from './ParseEventsList'

const RANGES = [7, 30, 90] as const

/**
 * Admin → Parses. Is the syllabus parser working, and if not, for whom and why.
 *
 * Leads with ONE sentence answering "is it healthy right now", because that
 * is the question that sends somebody to this tab; the numbers underneath are
 * for what comes after. Internal and test accounts are left out of every
 * count (the rule everywhere in this console) and the number left out is shown.
 */
export function ParsesTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const [data, setData] = useState<ParseOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      setBusy(true)
      try {
        const d = await loadParseOverview(days)
        if (active) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setBusy(false)
      }
    })()
    return () => {
      active = false
    }
  }, [days, tick])

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  if (error && !data) return <ErrorState message={error} />
  if (!data) return <Loading />

  const w = data.window
  const rate = w.total ? w.succeeded / w.total : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[22px] font-semibold text-fg">Syllabus parses</h1>
        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label="Range" className="flex rounded-lg bg-surface-2 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={days === r}
                onClick={() => setDays(r)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                  days === r ? 'bg-surface text-fg shadow-sm' : 'text-subtle hover:text-fg',
                )}
              >
                {r} days
              </button>
            ))}
          </div>
          <RefreshButton onClick={refresh} busy={busy} />
        </div>
      </div>

      <Health data={data} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Parses ever" value={String(data.total)} hint={`${data.today} today`} />
        <Stat
          label={`Success rate · ${days}d`}
          value={rate == null ? '—' : pct(w.succeeded, w.total)}
          hint={`${w.succeeded} of ${w.total} with a known outcome${w.unknown ? ` · ${w.unknown} unknown` : ''}`}
          tone={rate == null ? undefined : rate >= 0.9 ? 'good' : rate >= 0.7 ? 'warn' : 'bad'}
        />
        <Stat
          label="Processing now"
          value={String(data.processing)}
          hint={data.stalled ? `${data.stalled} never finished` : 'None stuck'}
          tone={data.stalled ? 'warn' : undefined}
        />
        <Stat
          label="Failed ever"
          value={String(data.failed)}
          hint={`${data.refunded} given back to the student`}
          tone={data.failed ? 'bad' : undefined}
        />
        <Stat label="Median time" value={secs(data.median_ms)} hint={`90% under ${secs(data.p90_ms)}`} />
        <Stat label="Last success" value={ago(data.last_success_at)} />
        <Stat label="Last failure" value={ago(data.last_failure_at)} />
        <Stat
          label="Read, found nothing"
          value={String(data.zero_items)}
          hint="Succeeded with 0 assessments"
          tone={data.zero_items ? 'warn' : undefined}
        />
      </div>

      <Panel title="Per day" sub={`Succeeded and failed parses, last ${days} days`}>
        <ParseDailyChart series={data.series} />
      </Panel>

      <ParseBreakdowns data={data} />

      <ParseEventsList onChanged={refresh} />

      <p className="text-[11px] text-subtle">
        Counts leave out internal and test accounts ({data.internal} parse{data.internal === 1 ? '' : 's'}); the list
        below shows them, tagged. {data.unknown} older parse{data.unknown === 1 ? '' : 's'} from before outcomes were
        recorded show as “unknown”. Failed uploads are kept 30 days so they can be retried, then deleted.
      </p>
    </div>
  )
}

function Health({ data }: { data: ParseOverview }) {
  const recentFail = withinDay(data.last_failure_at)
  const since = data.last_success_at && (!data.last_failure_at || data.last_success_at > data.last_failure_at)
  const stuck = data.stalled > 0 && data.processing === 0
  const bad = !!recentFail && !since
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]',
        bad ? 'border-danger/30 bg-danger/10 text-danger' : recentFail || stuck ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success',
      )}
    >
      {data.processing > 0 ? (
        <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" aria-hidden />
      ) : bad || recentFail ? (
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
      )}
      <span>
        {bad
          ? `Failing: the last parse failed ${ago(data.last_failure_at)} and none has succeeded since.`
          : recentFail
            ? `Working, with a failure in the last day (${ago(data.last_failure_at)}). Last success ${ago(data.last_success_at)}.`
            : `Healthy. Last success ${ago(data.last_success_at)}; no failures in the last day.`}
        {data.processing > 0 && ` ${data.processing} running right now.`}
        {stuck && ` ${data.stalled} parse${data.stalled === 1 ? "" : "s"} never finished (stopped by the platform).`}
      </span>
    </div>
  )
}
