import { useEffect, useState } from 'react'
import { Link2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface RefRow {
  ref: string
  signups: number
  visitors: number
  last_signup_at: string | null
}

/** Source links we hand out, by the cookie value they set (lib/ref-source.ts). */
const LINKS: Record<string, { label: string; path: string }> = {
  reddit: { label: 'Reddit', path: '/r' },
}

const AGO = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function ago(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  return Math.abs(days) < 1 ? 'today' : AGO.format(days, 'day')
}

/**
 * Signups per source link (concordiatracker.com/r = Reddit), from
 * `admin_ref_attribution()` (db/ref_attribution.sql).
 *
 * A DIFFERENT QUESTION FROM THE CHART BELOW IT. That one is what people SAY in
 * onboarding; this is what the link they arrived through RECORDED, so the two
 * can disagree and both are worth seeing. Reddit is always shown, even at zero,
 * because a link that has not converted yet is exactly the thing to notice.
 */
export function RefSignups() {
  const [rows, setRows] = useState<RefRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void supabase.rpc('admin_ref_attribution').then(({ data, error: err }) => {
      if (!active) return
      if (err) setError(err.message)
      else setRows((data as RefRow[] | null) ?? [])
    })
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-[12.5px] text-muted">
        Couldn&rsquo;t load source-link signups: {error}. Run
        <code className="mx-1 rounded bg-surface-2 px-1 py-0.5 text-[12px]">db/ref_attribution.sql</code>
        in Supabase.
      </div>
    )
  }

  const byRef = new Map((rows ?? []).map((r) => [r.ref, r]))
  const refs = [...new Set([...Object.keys(LINKS), ...byRef.keys()])]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {refs.map((ref) => {
        const r = byRef.get(ref)
        const link = LINKS[ref]
        const signups = r?.signups ?? 0
        const visitors = r?.visitors ?? 0
        return (
          <div key={ref} className="rounded-xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
              <Link2 size={14} className="text-accent" aria-hidden />
              {link?.label ?? ref} signups
              {link && <span className="text-subtle">· concordiatracker.com{link.path}</span>}
            </p>
            <p className="mt-2 font-display text-[30px] leading-none font-semibold tabular-nums text-fg">
              {rows === null ? '…' : signups}
            </p>
            <p className="mt-2 text-[12px] text-subtle">
              {rows === null
                ? 'Loading'
                : `${visitors} visitor${visitors === 1 ? '' : 's'} through the link${
                    visitors > 0 ? ` · ${Math.round((signups / visitors) * 100)}% signed up` : ''
                  }${r?.last_signup_at ? ` · last signup ${ago(r.last_signup_at)}` : ''}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
