import { useCallback, useEffect, useState } from 'react'
import { Activity, Eye, Globe, Loader2, Radio, RefreshCw, Smartphone, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Segmented } from '@/features/settings/controls'
import { cn } from '@/lib/cn'

interface Row {
  source?: string
  campaign?: string
  path?: string
  device?: string
  visitors: number
  views?: number
}
interface DailyRow {
  day: string
  visitors: number
  views: number
}
interface Traffic {
  live_now: number
  today_visitors: number
  today_views: number
  window_visitors: number
  window_views: number
  window_days: number
  new_visitors: number
  signed_in_visitors: number
  referrers: Row[]
  campaigns: Row[]
  top_pages: Row[]
  devices: Row[]
  daily: DailyRow[]
}

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

/** Where the traffic is coming from, and who's on the site right now. */
export function TrafficTab() {
  const [days, setDays] = useState('30')
  const [data, setData] = useState<Traffic | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async (d: string) => {
    const { data: res, error } = await supabase.rpc('admin_traffic_stats', { p_days: Number(d) })
    if (error) setErr(error.message)
    else {
      setData(res as Traffic)
      setErr('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      if (active) await load(days)
    })()
    // "Live now" is only meaningful if it's fresh — re-poll while the tab is open.
    const id = window.setInterval(() => void load(days), 30_000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [days, load])

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (err || !data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
        Couldn&rsquo;t load traffic{err ? `: ${err}` : ''}. If this persists, run{' '}
        <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">db/analytics.sql</code> in Supabase.
      </div>
    )
  }

  const returning = Math.max(0, data.window_visitors - data.new_visitors)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-fg">Traffic</h1>
          <p className="text-[13px] text-subtle">Anonymous, first-party: no third-party trackers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented value={days} onChange={setDays} options={RANGES} ariaLabel="Date range" />
          <button
            type="button"
            onClick={() => void load(days)}
            aria-label="Refresh"
            className="grid size-8 place-items-center rounded-lg border border-border text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <RefreshCw size={14} aria-hidden />
          </button>
        </div>
      </header>

      {/* Headline */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Live value={data.live_now} />
        <Stat icon={Users} label="Visitors today" value={data.today_visitors} sub={`${data.today_views} views`} />
        <Stat icon={Eye} label={`Visitors · ${data.window_days}d`} value={data.window_visitors} sub={`${data.window_views} views`} />
        <Stat icon={UserPlus} label="New visitors" value={data.new_visitors} sub={`${returning} returning`} />
      </div>

      {/* Daily chart */}
      <Panel title="Visitors per day">
        <DailyChart rows={data.daily} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Where they come from" icon={Globe}>
          <BarList rows={data.referrers} labelKey="source" empty="No referrer data yet." />
        </Panel>
        <Panel title="Most visited pages">
          <BarList rows={data.top_pages} labelKey="path" empty="No page views yet." />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Campaigns" icon={Activity}>
          {data.campaigns.length === 0 ? (
            <Empty>
              Tag your links with <code className="rounded bg-surface-2 px-1">?utm_source=instagram</code> to
              see which posts bring students in.
            </Empty>
          ) : (
            <ul className="space-y-2">
              {data.campaigns.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-fg">
                    {c.source}
                    {c.campaign && c.campaign !== '—' && (
                      <span className="text-subtle"> · {c.campaign}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">{c.visitors}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Devices" icon={Smartphone}>
          <BarList rows={data.devices} labelKey="device" empty="No device data yet." />
        </Panel>
      </div>

      <p className="rounded-lg border border-border bg-surface/50 px-4 py-3 text-[12px] leading-relaxed text-subtle">
        Anonymous by design: random per-browser ids, referrer host only, and paths are normalized
        before they&rsquo;re stored: so invite tokens never land in analytics. No cookies, no IP
        addresses, no third-party scripts.
      </p>
    </div>
  )
}

function Live({ value }: { value: number }) {
  return (
    <div className="rounded-xl border border-accent/50 bg-accent-soft/30 p-3.5">
      <div className="flex items-center gap-1.5 text-accent">
        <span className="relative flex size-2">
          {value > 0 && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
          )}
          <span className={cn('relative inline-flex size-2 rounded-full', value > 0 ? 'bg-accent' : 'bg-subtle')} />
        </span>
        <span className="text-[11.5px] font-medium">Online now</span>
      </div>
      <p className="mt-1.5 text-[24px] font-semibold text-fg tabular-nums">{value}</p>
      <p className="text-[11px] text-subtle">active in the last 5 min</p>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users
  label: string
  value: number
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-subtle">
        <Icon size={14} aria-hidden />
        <span className="text-[11.5px] font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-[24px] font-semibold text-fg tabular-nums">{value.toLocaleString()}</p>
      {sub && <p className="text-[11px] text-subtle">{sub}</p>}
    </div>
  )
}

function DailyChart({ rows }: { rows: DailyRow[] }) {
  if (rows.length === 0) return <Empty>No data yet.</Empty>
  const max = Math.max(1, ...rows.map((r) => r.visitors))
  // Only label a handful of days so the axis stays readable.
  const step = Math.ceil(rows.length / 8)
  return (
    <>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {rows.map((r) => (
          <div key={r.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-sm bg-accent/70 transition-[height] duration-500 group-hover:bg-accent"
              style={{ height: `${Math.max(r.visitors > 0 ? 4 : 1.5, (r.visitors / max) * 100)}%` }}
              title={`${r.day}: ${r.visitors} visitors · ${r.views} views`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {rows.map((r, i) => (
          <span key={r.day} className="flex-1 text-center text-[9.5px] text-subtle">
            {i % step === 0 ? r.day.slice(5) : ''}
          </span>
        ))}
      </div>
    </>
  )
}

function BarList({ rows, labelKey, empty }: { rows: Row[]; labelKey: keyof Row; empty: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>
  const max = Math.max(1, ...rows.map((r) => r.visitors))
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-[12.5px] text-fg" title={String(r[labelKey])}>
            {String(r[labelKey])}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-surface-2">
            <div className="h-full rounded bg-accent/70" style={{ width: `${(r.visitors / max) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-muted">{r.visitors}</span>
        </li>
      ))}
    </ul>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: typeof Radio
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        {Icon && <Icon size={14} className="text-subtle" aria-hidden />}
        {title}
      </h2>
      <div className="rounded-xl border border-border bg-surface p-4">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-[12.5px] leading-relaxed text-subtle">{children}</p>
}
