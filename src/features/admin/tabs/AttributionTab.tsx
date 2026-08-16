import { useEffect, useState } from 'react'
import { Compass, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { HEARD_LABELS, HEARD_SOURCES } from '@/features/onboarding/heard-about'

interface Attribution {
  total: number
  answered: number
  counts: Record<string, number>
  other_details: string[]
}

/** Admin view: where users say they found us (onboarding attribution). Reads the
 * SECURITY DEFINER `attribution_summary()` rollup (db/attribution.sql). */
export function AttributionTab() {
  const [data, setData] = useState<Attribution | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data: res, error: err } = await supabase.rpc('attribution_summary')
      if (!active) return
      if (err) setError(err.message)
      else setData(res as Attribution)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
        Couldn&rsquo;t load attribution{error ? `: ${error}` : ''}. If this persists, run
        <code className="mx-1 rounded bg-surface-2 px-1 py-0.5 text-[12px]">db/attribution.sql</code>
        in Supabase.
      </div>
    )
  }

  const counts = data.counts ?? {}
  // Ordered rows (known sources first, then any unknown ids), sorted by count desc.
  const known = HEARD_SOURCES.map((s) => ({ id: s.id, label: s.label, n: counts[s.id] ?? 0 }))
  const extra = Object.keys(counts)
    .filter((id) => !(id in HEARD_LABELS))
    .map((id) => ({ id, label: id, n: counts[id] }))
  const rows = [...known, ...extra].sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...rows.map((r) => r.n))
  const answered = data.answered ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
          <Compass size={18} aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Where people come from</h2>
          <p className="text-[12.5px] text-subtle">
            {answered} of {data.total} users answered the onboarding question
          </p>
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl border border-border bg-surface p-4">
        {answered === 0 ? (
          <p className="py-6 text-center text-[13px] text-subtle">No answers yet.</p>
        ) : (
          rows.map((r) => {
            const pct = answered > 0 ? Math.round((r.n / answered) * 100) : 0
            return (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-[12.5px] font-medium text-fg">{r.label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-surface-2">
                  <div
                    className="h-full rounded-md bg-accent transition-[width] duration-500"
                    style={{ width: `${(r.n / max) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-muted">
                  {r.n} · {pct}%
                </span>
              </div>
            )
          })
        )}
      </div>

      {data.other_details?.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-2.5 text-[13px] font-semibold text-fg">
            &ldquo;Somewhere else&rdquo; write-ins ({data.other_details.length})
          </p>
          <ul className="space-y-1.5">
            {data.other_details.map((d, i) => (
              <li key={i} className="rounded-lg bg-surface-2/50 px-3 py-2 text-[12.5px] text-muted">
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
