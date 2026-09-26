import { useEffect, useState } from 'react'
import { ManualParseModal } from './ManualParseModal'
import { FileText, Loader2, RotateCw, PenLine } from 'lucide-react'
import { ErrorState, Panel, Pill } from '../admin-ui'
import { cn } from '@/lib/cn'
import { loadParseEvents, openStoredFile, retryParse, type ParseEvent, type ParseStatus } from './parse-data'
import { kb, pathLabel, secs, when } from './format'

const FILTERS = [
  { id: null, label: 'All' },
  { id: 'problems', label: 'Problems' },
  { id: 'succeeded', label: 'Succeeded' },
  { id: 'processing', label: 'Processing' },
  { id: 'unknown', label: 'Unknown' },
] as const

const STATUS: Record<ParseStatus, { tone: string; label: string }> = {
  succeeded: { tone: 'green', label: 'Succeeded' },
  failed: { tone: 'red', label: 'Failed' },
  processing: { tone: 'blue', label: 'Processing' },
  stalled: { tone: 'amber', label: 'Never finished' },
  unknown: { tone: 'neutral', label: 'Unknown' },
}

/**
 * Every parse, newest first, with what went wrong and a Retry on each failure
 * whose file was kept. A retry never touches the student's courses: the result
 * waits on the parse and the student is sent a link to review it.
 */
export function ParseEventsList({ onChanged }: { onChanged: () => void }) {
  const [filter, setFilter] = useState<string | null>('problems')
  const [rows, setRows] = useState<ParseEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    loadParseEvents(filter)
      .then((r) => {
        if (!active) return
        setRows(r)
        setError(null)
      })
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [filter, tick])

  return (
    <Panel
      title="Every parse"
      sub="Newest first. Retry re-reads a failed upload and sends the student the result to review."
      action={
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setRows(null)
                setFilter(f.id)
              }}
              className={cn(
                'rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                filter === f.id ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {error ? (
        <div className="p-4">
          <ErrorState message={error} />
        </div>
      ) : rows === null ? (
        <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-subtle">
          <Loader2 size={14} className="animate-spin" aria-hidden /> Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-subtle">Nothing here.</p>
      ) : (
        <ul className="max-h-[36rem] overflow-y-auto">
          {rows.map((e) => (
            <Row
              key={e.id}
              e={e}
              onRetried={() => {
                setTick((n) => n + 1)
                onChanged()
              }}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Row({ e, onRetried }: { e: ParseEvent; onRetried: () => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const s = STATUS[e.status]
  const who = e.name || (e.handle ? `@${e.handle}` : e.email) || 'Unknown'
  const canRetry = e.has_file && e.status !== 'succeeded' && e.retry_status !== 'succeeded'

  const retry = async () => {
    setBusy(true)
    setNote(null)
    try {
      const r = await retryParse(e.id)
      setNote(
        r.ok
          ? `Read it: ${r.items} assessment${r.items === 1 ? '' : 's'}${r.course ? ` for ${r.course}` : ''}. The student was sent a link to review.`
          : `Still failed: ${r.error ?? 'unknown'}`,
      )
      onRetried()
    } catch (err) {
      setNote((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="border-t border-border/70 px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Pill tone={s.tone}>{s.label}</Pill>
        {e.refunded && <Pill>Given back</Pill>}
        {e.internal && <Pill tone="blue">Internal</Pill>}
        {e.source !== 'upload' && <Pill>{e.source === 'api' ? 'Personal API' : e.source}</Pill>}
        <span className="text-[13px] font-medium text-fg">{who}</span>
        {e.course_code && <span className="text-[12px] text-muted">· {e.course_code}</span>}
        <span className="ml-auto text-[11.5px] tabular-nums text-subtle">{when(e.created_at)}</span>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-subtle">
        {e.file_name && <span className="max-w-full truncate text-muted">{e.file_name}</span>}
        {e.bytes != null && <span>{kb(e.bytes)}</span>}
        {e.path && <span>{pathLabel(e.path)}</span>}
        {e.items != null && <span>{e.items} item{e.items === 1 ? '' : 's'}</span>}
        {e.duration_ms != null && <span>{secs(e.duration_ms)}</span>}
      </p>
      {e.error && <p className="mt-1 text-[12px] break-words text-danger">{e.error}</p>}
      {e.retry_status && (
        <p className={cn('mt-1 text-[12px]', e.retry_status === 'succeeded' || e.retry_status === 'delivered' ? 'text-success' : 'text-warning')}>
          Retried {e.retried_at ? when(e.retried_at) : ''}:{' '}
          {e.retry_status === 'succeeded'
            ? 'read it, student notified'
            : e.retry_status === 'delivered'
              ? 'parsed by hand and added to their courses'
              : e.retry_error || 'failed again'}
        </p>
      )}
      {manual && (
        <ManualParseModal
          event={e}
          onClose={() => setManual(false)}
          onDone={(m) => {
            setNote(m)
            onRetried()
          }}
        />
      )}
      {(canRetry || e.has_file) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canRetry && (
            <button
              type="button"
              disabled={busy}
              onClick={retry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-contrast transition-opacity duration-150 disabled:opacity-60"
            >
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RotateCw size={13} aria-hidden />}
              {busy ? 'Retrying… (up to a minute)' : 'Retry'}
            </button>
          )}
          {e.has_file && (
            <button
              type="button"
              onClick={() => void openStoredFile(e.user_id, e.id).catch((err: Error) => setNote(err.message))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
            >
              <FileText size={13} aria-hidden /> Open file
            </button>
          )}
          {e.has_file && (
            <button
              type="button"
              onClick={() => setManual(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
            >
              <PenLine size={13} aria-hidden /> Parse manually
            </button>
          )}
        </div>
      )}
      {note && (
        <p role="status" className="mt-1.5 text-[12px] text-muted">
          {note}
        </p>
      )}
    </li>
  )
}
