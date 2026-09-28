import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { ErrorState, Loading, Panel } from '../admin-ui'

interface Row {
  platform: string
  min_build: number
  latest_build: number
  store_url: string
  updated_at: string
}

function asBuild(s: string): number | null {
  const n = Number(s)
  return s.trim() !== '' && Number.isInteger(n) && n >= 1 ? n : null
}

/**
 * The minimum and latest iOS build (db/app_versions.sql), read by
 * /api/app-version on every launch of the app.
 *
 * The one control in the console that can lock every phone out, so raising
 * the minimum takes a second press and the warning is printed beside it
 * rather than in a tooltip.
 */
export function AppVersionTab() {
  const [row, setRow] = useState<Row | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [min, setMin] = useState('')
  const [latest, setLatest] = useState('')
  const [saving, setSaving] = useState(false)
  const [armed, setArmed] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('app_versions')
      .select('platform, min_build, latest_build, store_url, updated_at')
      .eq('platform', 'ios')
      .maybeSingle()
    if (e || !data) {
      setError(e?.message ?? 'No iOS row. Run db/app_versions.sql.')
      return
    }
    const r = data as Row
    setRow(r)
    setMin(String(r.min_build))
    setLatest(String(r.latest_build))
  }, [])

  useEffect(() => {
    // Deferred: the lint rule against setState in an effect body.
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load])

  if (error) return <ErrorState message={error} />
  if (!row) return <Loading />

  const m = asBuild(min)
  const l = asBuild(latest)
  const problem =
    m === null || l === null ? 'Builds are whole numbers of 1 or more.' : m > l ? 'The minimum cannot be above the latest.' : null
  const raising = m !== null && m > row.min_build
  const changed = m !== row.min_build || l !== row.latest_build

  async function save() {
    if (problem || m === null || l === null) return
    if (raising && !armed) {
      setArmed(true)
      return
    }
    setSaving(true)
    const { error: e } = await supabase.rpc('admin_set_app_version', {
      p_platform: 'ios',
      p_min_build: m,
      p_latest_build: l,
    })
    setSaving(false)
    setArmed(false)
    if (e) {
      setError(e.message)
      return
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
    await load()
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Panel
        title="iOS app version"
        sub={`Checked by the app on every launch · last changed ${new Date(row.updated_at).toLocaleString()}`}
      >
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-subtle">Minimum build</span>
              <input
                value={min}
                onChange={(e) => {
                  setMin(e.target.value)
                  setArmed(false)
                }}
                inputMode="numeric"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[15px] text-fg tabular-nums outline-none focus:border-border-strong"
              />
              <span className="mt-1 block text-[11.5px] text-subtle">Below this: a blocking “Please update” screen.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-subtle">Latest build</span>
              <input
                value={latest}
                onChange={(e) => {
                  setLatest(e.target.value)
                  setArmed(false)
                }}
                inputMode="numeric"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[15px] text-fg tabular-nums outline-none focus:border-border-strong"
              />
              <span className="mt-1 block text-[11.5px] text-subtle">Below this: a banner that can be dismissed.</span>
            </label>
          </div>

          <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[12.5px] leading-relaxed text-fg">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <p>
              Keep the minimum <strong>below</strong> the build on your own phone and every tester’s. Raising it above the
              TestFlight or App Store build locks all of them out. Raise it only once the new App Store build is live. The
              web app is never affected.
            </p>
          </div>

          {problem && <p className="text-[12.5px] text-danger">{problem}</p>}
          {armed && (
            <p className="text-[12.5px] font-medium text-danger">
              Every iPhone on a build below {m} will be locked out until it updates. Press again to confirm.
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => void save()} disabled={!!problem || !changed || saving}>
              {saving ? 'Saving…' : armed ? `Yes, require build ${m}` : 'Save'}
            </Button>
            {saved && <span className="text-[12.5px] text-success">Saved. Phones pick it up within a minute.</span>}
          </div>
        </div>
      </Panel>
    </div>
  )
}
