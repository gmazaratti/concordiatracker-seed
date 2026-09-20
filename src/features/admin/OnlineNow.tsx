import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2, Monitor, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

interface OnlineRow {
  user_id: string
  name: string | null
  email: string | null
  path: string | null
  last_seen: string
  seconds: number
  device: string | null
  is_internal: boolean
}

/**
 * Who is on the site right now, and where.
 *
 * A COUNT IS NOT THE INTERESTING PART. "3 online" tells you the lights are
 * on; "Mani, on /app/calendar, for 12 minutes" tells you who to message and
 * about what — which is exactly the moment the message tool is for.
 *
 * ONLINE MEANS AN EVENT IN THE LAST FIVE MINUTES, not a socket. The app
 * already sends a heartbeat, so this is real activity rather than a tab
 * somebody left open in another window three hours ago.
 *
 * Internal accounts are listed but marked and never counted — seeing
 * yourself in the list is useful, counting yourself as a user is not.
 */
export function OnlineNow({ count }: { count: number }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<OnlineRow[] | null>(null)

  const [polls, setPolls] = useState(0)
  const poll = useCallback(() => setPolls((n) => n + 1), [])

  useEffect(() => {
    if (!open) return
    let alive = true
    void supabase.rpc('admin_online_now', { p_minutes: 5 }).then(({ data, error }) => {
      if (!alive) return
      setRows(error ? [] : ((data ?? []) as OnlineRow[]))
    })
    return () => {
      alive = false
    }
  }, [open, polls])

  // Only while the list is open: a 20s poll behind a closed panel is a
  // request nobody asked for.
  useEffect(() => {
    if (!open) return
    const t = window.setInterval(() => document.visibilityState === 'visible' && poll(), 20_000)
    return () => window.clearInterval(t)
  }, [open, poll])

  const real = (rows ?? []).filter((r) => !r.is_internal)

  return (
    <div className="rounded-xl border border-accent/50 bg-accent-soft/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full p-3.5 text-left"
      >
        <div className="flex items-center gap-1.5 text-accent">
          <span className="relative flex size-2">
            {count > 0 && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
            )}
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                count > 0 ? 'bg-accent' : 'bg-subtle',
              )}
            />
          </span>
          <span className="text-[11.5px] font-medium">Online now</span>
          <ChevronDown
            size={13}
            className={cn('ml-auto transition-transform duration-200', open && 'rotate-180')}
            aria-hidden
          />
        </div>
        <p className="mt-1.5 text-[24px] font-semibold text-fg tabular-nums">{count}</p>
        <p className="text-[11px] text-subtle">
          {open ? 'active in the last 5 min' : 'active in the last 5 min · tap to see who'}
        </p>
      </button>

      {open && (
        <div className="border-t border-accent/30 px-3.5 py-2.5">
          {rows === null ? (
            <p className="flex items-center gap-2 py-2 text-[12px] text-subtle">
              <Loader2 size={13} className="animate-spin" aria-hidden />
              Looking
            </p>
          ) : rows.length === 0 ? (
            <p className="py-2 text-[12px] text-subtle">Nobody signed in right now.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.user_id} className="flex items-start gap-2">
                  {r.device === 'mobile' ? (
                    <Smartphone size={12} className="mt-1 shrink-0 text-subtle" aria-label="Mobile" />
                  ) : (
                    <Monitor size={12} className="mt-1 shrink-0 text-subtle" aria-label="Desktop" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-fg">
                      {r.name || r.email || 'Unnamed'}
                      {r.is_internal && (
                        <span className="rounded bg-surface-2 px-1 text-[10px] text-subtle">you</span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[11px] text-subtle">{r.path ?? '—'}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-subtle tabular-nums">
                    {mins(r.seconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {rows && rows.length !== real.length && (
            <p className="mt-2 text-[10.5px] text-subtle">
              The count above excludes your own accounts; the list shows them.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** How long THIS visit has run. Zero means they have sent one event, which
 *  is a visit with no measurable length rather than a zero-second one. */
function mins(seconds: number): string {
  if (seconds < 60) return 'just arrived'
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`
}
