import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bot, ExternalLink, Loader2, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TokenPanel } from '@/features/tokens/TokenPanel'
import { EmptyState, Panel } from '../admin-ui'
import { AssistantTokens } from '../assistant/AssistantTokens'
import { AssistantActivity } from '../assistant/AssistantActivity'
import { fmtDateTime } from '../admin-data'
import { cn } from '@/lib/cn'

interface Reply {
  id: number
  sent_at: string
  thread: string | null
  case_id: string | null
  subject: string | null
  customer: string
  body: string
  status_now: string | null
  needs_human: boolean | null
}

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
]

/**
 * What the assistant has been saying in your name.
 *
 * THE POINT IS THE WORDING, NOT THE COUNT. "Alfred answered 6 tickets" tells
 * you nothing you would act on; the sentence he actually sent is the thing
 * you either stand behind or go and correct. So every row shows the full
 * text, not a preview — there is no "…" and no expander, because the one
 * thing worth checking must not be the thing behind a click.
 *
 * IT READS THE AUDIT LOG, not the messages table. The same text is in both,
 * but the audit row is the record OF THE ACT: it survives the thread being
 * deleted and cannot be edited from inside the product.
 *
 * A reply sitting on a thread a person has SINCE taken over is the
 * interesting one — it means the machine had a go and a human disagreed — so
 * the current state of the thread is joined forward and flagged.
 */
export function AssistantTab() {
  const [days, setDays] = useState(1)
  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  /**
   * What came back, and which request it answers.
   *
   * Kept together rather than as `rows` plus a `loading` flag, because
   * clearing the flag synchronously at the top of the effect is
   * `set-state-in-effect` — the lint this codebase keeps meeting. With the
   * key stored alongside the data, "still loading" is something the render
   * can WORK OUT rather than something an effect has to announce.
   */
  const [loaded, setLoaded] = useState<{ key: string; rows: Reply[]; err: string } | null>(null)
  const key = `${days}:${reloads}`

  useEffect(() => {
    let alive = true
    void supabase.rpc('admin_ai_replies', { p_days: days, p_limit: 200 }).then(({ data, error }) => {
      if (!alive) return
      // An empty list and a failed load are different facts. Showing "nothing
      // sent" for a broken query is the ticket bug again.
      setLoaded({ key, rows: error ? [] : ((data ?? []) as Reply[]), err: error?.message ?? '' })
    })
    return () => {
      alive = false
    }
  }, [days, key])

  const rows = loaded?.key === key ? loaded.rows : null
  const err = loaded?.key === key ? loaded.err : ''

  const takenOver = (rows ?? []).filter((r) => r.status_now === 'human_takeover').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-display text-[17px] font-semibold text-fg">
          What the assistant sent
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                days === r.days ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={reload}
          className="rounded-md border border-border px-2.5 py-1 text-[12px] text-muted transition-colors hover:text-fg"
        >
          Refresh
        </button>
      </div>

      {takenOver > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[12.5px] text-fg">
          <ShieldAlert size={14} className="mt-px shrink-0 text-warning" aria-hidden />
          <span>
            {takenOver} of these {takenOver === 1 ? 'is' : 'are'} on a thread a person has since
            taken over. Worth reading, because it means the machine had a go and someone
            disagreed.
          </span>
        </p>
      )}

      <Panel
        title="Replies"
        sub={rows ? `${rows.length} in the last ${days === 1 ? 'day' : `${days} days`}` : '…'}
      >
        {rows === null ? (
          <p className="flex items-center gap-2 px-3.5 py-6 text-[12.5px] text-subtle">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Loading
          </p>
        ) : err ? (
          <p className="flex items-start gap-2 px-3.5 py-6 text-[12.5px] text-danger">
            <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
            <span>
              Could not load these: {err}. If the migration has not been run yet, that is
              db/personal_api.sql.
            </span>
          </p>
        ) : rows.length === 0 ? (
          <EmptyState>
            Nothing sent in this window. Replies the assistant makes through
            /api/v1/support appear here with their exact wording.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Bot size={13} className="shrink-0 text-accent" aria-hidden />
                  <span className="text-[12.5px] font-medium text-fg">
                    {r.case_id ?? 'Unknown case'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-subtle">
                    {r.subject ?? ''} · {r.customer}
                  </span>
                  {r.status_now && (
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10.5px]',
                        r.status_now === 'human_takeover'
                          ? 'bg-warning/15 text-warning'
                          : r.status_now === 'resolved'
                            ? 'bg-success/15 text-success'
                            : 'bg-surface-2 text-subtle',
                      )}
                    >
                      {r.status_now.replace('_', ' ')}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-subtle">{fmtDateTime(r.sent_at)}</span>
                </div>

                {/* The whole thing. This is the one screen where a preview
                    would defeat the purpose. */}
                <p className="mt-1.5 rounded-md bg-surface-2 px-2.5 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap text-fg">
                  {r.body}
                </p>

                {r.thread && (
                  <a
                    href="?tab=tickets"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline"
                  >
                    Open the conversation
                    <ExternalLink size={11} aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Assistant access" sub="API keys">
        <div className="space-y-5 p-3.5">
          {/* The assistant's own key: acts as the assistant identity. */}
          <AssistantTokens />
          <div className="border-t border-border pt-4">
            <TokenPanel scope="admin" />
          </div>
          <div className="border-t border-border pt-4">
            <TokenPanel scope="support" />
          </div>
          <div className="border-t border-border pt-4">
            <TokenPanel scope="me" />
          </div>
          <div className="border-t border-border pt-4">
            <TokenPanel scope="owner" />
          </div>
        </div>
      </Panel>

      <Panel title="Assistant activity" sub="Every write the assistant makes">
        <AssistantActivity />
      </Panel>
    </div>
  )
}
