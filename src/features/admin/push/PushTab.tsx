import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Loading, Panel, RefreshButton, Stat } from '../admin-ui'
import { cn } from '@/lib/cn'
import { KIND_LABEL, loadPushAnalytics, minutes, rate, type PushAnalytics } from './push-analytics'
import { DailyBars, HourBars } from './PushCharts'

const RANGES = [7, 30, 90] as const
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * Admin → Push. Who can be reached, how many pushes went out, and how many
 * people tapped them, split by what the push was for.
 *
 * "Opened" means they tapped into the app (the link carries a log id). A push
 * read on the lock screen and swiped away counts as not opened, so every rate
 * here is a floor. Pushes were only logged from 2026-11-10.
 */
export function PushTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const [data, setData] = useState<PushAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      setBusy(true)
      try {
        const d = await loadPushAnalytics(days)
        if (alive) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (alive) setError((e as Error).message)
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [days, tick])

  if (error && !data) return <ErrorState message={error} />
  if (!data) return <Loading />
  const { reach, totals } = data
  // Your own admin alerts and test pushes would flatter the student numbers.
  const studentKinds = data.by_kind.filter((k) => k.kind !== 'admin_alert' && k.kind !== 'test')
  const sDelivered = studentKinds.reduce((n, k) => n + k.delivered, 0)
  const sOpened = studentKinds.reduce((n, k) => n + k.opened, 0)
  const reachPct = reach.users ? Math.round((reach.with_push / reach.users) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[22px] font-semibold text-fg">Push</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={days === r}
                onClick={() => setDays(r)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[12px] font-medium',
                  days === r ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {r} days
              </button>
            ))}
          </div>
          <RefreshButton onClick={() => setTick((n) => n + 1)} busy={busy} />
        </div>
      </div>
      <p className="-mt-3 text-[12px] text-subtle">
        Opened means they tapped the push into the app, so these rates are a floor. Logged since November 10, 2026.
        Internal accounts are not counted.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Can be reached"
          value={`${reach.with_push} of ${reach.users}`}
          hint={`${reachPct}% have notifications on`}
          tone={reachPct < 25 ? 'warn' : undefined}
        />
        <Stat label="Devices" value={String(reach.devices)} hint={`${reach.web} on web, ${reach.iphone} on iPhone`} />
        <Stat label="Delivered to students" value={String(sDelivered)} hint={`${totals.people_reached} people reached`} />
        <Stat
          label="Open rate (students)"
          value={rate(sOpened, sDelivered)}
          hint={`${sOpened} opened · median ${minutes(totals.median_open_minutes)} to open`}
        />
      </div>

      <Panel title="Delivered and opened, per day">
        <DailyBars daily={data.daily} />
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="By type" sub="Which kinds of push people actually tap.">
          {data.by_kind.length === 0 ? (
            <p className="text-[12.5px] text-subtle">Nothing sent in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-[11px] text-subtle">
                  <tr>
                    <th className="pb-1.5 font-medium">Type</th>
                    <th className="pb-1.5 text-right font-medium">Delivered</th>
                    <th className="pb-1.5 text-right font-medium">Opened</th>
                    <th className="pb-1.5 text-right font-medium">Rate</th>
                    <th className="pb-1.5 text-right font-medium">Time to open</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.by_kind.map((k) => (
                    <tr key={k.kind} className="border-t border-border">
                      <td className="py-1.5 text-fg">{KIND_LABEL[k.kind] ?? k.kind}</td>
                      <td className="py-1.5 text-right text-muted">{k.delivered}</td>
                      <td className="py-1.5 text-right text-muted">{k.opened}</td>
                      <td className="py-1.5 text-right font-medium text-fg">{rate(k.opened, k.delivered)}</td>
                      <td className="py-1.5 text-right text-subtle">{minutes(k.median_open_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Best time to send" sub="Open rate by the hour the push went out (Montreal time).">
          <HourBars hours={data.by_hour} />
        </Panel>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="Recent sends" sub="Your pushes, notifications, seat alerts and trial notices.">
          {data.sends.length === 0 ? (
            <p className="text-[12.5px] text-subtle">Nothing yet.</p>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {data.sends.map((s, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md bg-canvas px-2.5 py-1.5 text-[12.5px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{s.title}</span>
                    <span className="block text-[11px] text-subtle">
                      {KIND_LABEL[s.kind] ?? s.kind} · {when(s.at)} · {s.people} {s.people === 1 ? 'person' : 'people'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block font-medium text-fg">{rate(s.opened, s.delivered)}</span>
                    <span className="block text-[11px] text-subtle">
                      {s.opened}/{s.delivered}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Who opens them" sub="Students who tap through most. Your own alerts are left out.">
          {data.top_openers.length === 0 ? (
            <p className="text-[12.5px] text-subtle">Nobody yet.</p>
          ) : (
            <ul className="space-y-1">
              {data.top_openers.map((o) => (
                <li key={o.user_id} className="flex items-center gap-2 text-[12.5px]">
                  <Link to={`?tab=users&user=${o.user_id}`} className="min-w-0 flex-1 truncate text-fg hover:underline">
                    {o.name ?? 'No name'} {o.handle && <span className="text-subtle">@{o.handle}</span>}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted">
                    {o.opened}/{o.delivered} · {rate(o.opened, o.delivered)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
