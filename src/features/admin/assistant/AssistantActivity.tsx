import { useEffect, useState } from 'react'
import { describeAction, listAssistantActivity, type AssistantAction } from './assistant-data'

/**
 * Every write the assistant identity made, newest first. Recorded by a
 * database trigger on each content table (db/assistant_grant.sql), so no API
 * code path can skip it. Actor is always the assistant; this shows club,
 * action, what it was, and when.
 */
export function AssistantActivity() {
  const [rows, setRows] = useState<AssistantAction[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    listAssistantActivity(200).then(
      (r) => alive && setRows(r),
      (e: unknown) => alive && setErr(e instanceof Error ? e.message : 'Could not load the activity.'),
    )
    return () => {
      alive = false
    }
  }, [])

  if (err) return <p className="p-3.5 text-[12.5px] text-danger">{err}</p>
  if (!rows) return <p className="p-3.5 text-[12.5px] text-subtle">Loading…</p>
  if (rows.length === 0) return <p className="p-3.5 text-[12.5px] text-subtle">The assistant has not changed anything yet.</p>

  return (
    <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
      {rows.map((r, i) => (
        <li key={`${r.created_at}-${i}`} className="flex items-start gap-3 px-3.5 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-fg">
              {describeAction(r.action)}
              {r.org_handle && <span className="text-muted"> on {r.org_name || r.org_handle}</span>}
            </span>
            {r.summary && <span className="block truncate text-[12px] text-subtle">{r.summary}</span>}
          </span>
          <time className="shrink-0 text-[11.5px] text-subtle tabular-nums" dateTime={r.created_at}>
            {new Date(r.created_at).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  )
}
