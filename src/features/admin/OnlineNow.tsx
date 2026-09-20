import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2, Monitor, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ModalShell } from '@/command/ModalShell'
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
 * about what — which is exactly the moment the message tool is for. So each
 * row opens that person in the admin panel, where the message box already is.
 *
 * A POP-OUT, NOT A DISCLOSURE. Expanding in place pushed the card taller than
 * its three siblings and broke the row they sit in — the panel is a fixed-size
 * stat card and the list is an unbounded list, so one cannot live inside the
 * other. The dialog also gives the rows somewhere to be clickable without
 * nesting buttons inside a button.
 *
 * ONLINE MEANS AN EVENT IN THE LAST FIVE MINUTES, not a socket. The app
 * already sends a heartbeat, so this is real activity rather than a tab
 * somebody left open in another window three hours ago.
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

  // Only while the list is open: a 20s poll behind a closed dialog is a
  // request nobody asked for.
  useEffect(() => {
    if (!open) return
    const t = window.setInterval(() => document.visibilityState === 'visible' && poll(), 20_000)
    return () => window.clearInterval(t)
  }, [open, poll])

  const real = (rows ?? []).filter((r) => !r.is_internal)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="w-full rounded-xl border border-accent/50 bg-accent-soft/30 p-3.5 text-left transition-colors duration-150 hover:border-accent/70"
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
          <ChevronRight size={13} className="ml-auto" aria-hidden />
        </div>
        <p className="mt-1.5 text-[24px] font-semibold text-fg tabular-nums">{count}</p>
        <p className="text-[11px] text-subtle">active in the last 5 min · tap to see who</p>
      </button>

      {open && (
        <ModalShell label="Who is online" onClose={() => setOpen(false)}>
          <div className="px-4 pt-4 pb-1">
            <h2 className="text-[15px] font-semibold text-fg">Online now</h2>
            <p className="mt-0.5 text-[12px] text-subtle">
              Anyone who sent an event in the last five minutes.
            </p>
          </div>

          <div className="px-2 pb-3">
            {rows === null ? (
              <p className="flex items-center gap-2 px-2 py-6 text-[12.5px] text-subtle">
                <Loader2 size={13} className="animate-spin" aria-hidden />
                Looking
              </p>
            ) : rows.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12.5px] text-subtle">
                Nobody signed in right now.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {rows.map((r) => (
                  <li key={r.user_id}>
                    {/* A real link, not a handler: it opens the user panel on
                        the Users tab — where the message box, the plan
                        controls and the audit trail already live — and being
                        an anchor means it can be opened in a new tab like
                        anything else. */}
                    <a
                      href={`?tab=users&user=${r.user_id}`}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                    >
                      {r.device === 'mobile' ? (
                        <Smartphone size={13} className="mt-1 shrink-0 text-subtle" aria-label="Mobile" />
                      ) : (
                        <Monitor size={13} className="mt-1 shrink-0 text-subtle" aria-label="Desktop" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-fg">
                            {r.name || r.email || 'Unnamed'}
                          </span>
                          {r.is_internal && (
                            <span className="rounded bg-surface-2 px-1 text-[10px] text-subtle">
                              you
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-subtle">
                          {r.path ?? '—'}
                        </span>
                      </span>
                      <span className="shrink-0 pt-0.5 text-right">
                        <span className="block text-[11.5px] text-subtle tabular-nums">
                          {mins(r.seconds)}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] text-accent">Open · message</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {rows && rows.length !== real.length && (
              <p className="mt-2 px-2 text-[10.5px] text-subtle">
                The count on the card excludes your own accounts; this list shows them.
              </p>
            )}
          </div>
        </ModalShell>
      )}
    </>
  )
}

/** How long THIS visit has run. Zero means they have sent one event, which
 *  is a visit with no measurable length rather than a zero-second one. */
function mins(seconds: number): string {
  if (seconds < 60) return 'just arrived'
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`
}
