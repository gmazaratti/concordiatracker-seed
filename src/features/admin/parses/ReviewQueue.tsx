import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, Inbox, PenLine, Undo2 } from 'lucide-react'
import { Panel } from '../admin-ui'
import { cn } from '@/lib/cn'
import { ManualParseModal } from './ManualParseModal'
import { ago } from './format'
import { loadReviewQueue, openStoredFile, resolveReview, undoDelivery, type ReviewRow } from './parse-data'

const FILTERS = [
  { id: 'queued', label: 'Waiting' },
  { id: 'delivered', label: 'Added' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'superseded', label: 'Replaced by a retry' },
] as const

const STATUS_LABEL: Record<ReviewRow['review_status'], string> = {
  queued: 'Waiting',
  delivered: 'Added to their courses',
  resolved: 'Resolved',
  superseded: 'Replaced by a retry',
}

/**
 * Failed uploads that still need a person (db/parse_review.sql).
 *
 * Every failed upload whose file was kept lands here on its own; a retry of
 * the same file replaces the older row (so one syllabus is one item), and a
 * later successful parse of it closes the row automatically. Students who
 * pressed "Leave it for review" lead the list, because they are the ones
 * explicitly waiting on us.
 *
 * From a row: open the file, parse it by hand (with a preview before anything
 * is written), undo a delivery that was wrong, or resolve with a note that
 * the student is sent. Every one of those is audited server-side.
 */
export function ReviewQueue({ onChanged }: { onChanged: () => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('queued')
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    loadReviewQueue(filter).then(
      (r) => alive && (setRows(r), setError(null)),
      (e: Error) => alive && setError(e.message),
    )
    return () => {
      alive = false
    }
  }, [filter, tick])

  const reload = () => {
    setTick((n) => n + 1)
    onChanged()
  }

  return (
    <Panel title="Review queue" sub="Failed uploads with a kept file. Waiting students first.">
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Review status">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => {
              setRows(null)
              setFilter(f.id)
            }}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[12px] font-medium',
              filter === f.id ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:text-fg',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-[12.5px] text-danger">{error}</p>
      ) : rows === null ? (
        <p className="text-[12.5px] text-subtle">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="flex items-center gap-2 text-[12.5px] text-subtle">
          <Inbox size={14} aria-hidden /> Nothing here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <ReviewItem key={r.id} r={r} onChanged={reload} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function ReviewItem({ r, onChanged }: { r: ReviewRow; onChanged: () => void }) {
  const [manual, setManual] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const who = r.name || (r.handle ? `@${r.handle}` : r.email) || 'Unknown student'

  async function run(fn: () => Promise<string>) {
    setBusy(true)
    try {
      setNote(await fn())
      onChanged()
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-60'

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[13.5px] font-semibold text-fg">{who}</span>
        {r.email && <span className="min-w-0 truncate text-[12px] text-subtle">{r.email}</span>}
        {r.review_requested_at && r.review_status === 'queued' && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">Asked for review</span>
        )}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-subtle">
        {r.file_name && <span className="max-w-full truncate text-muted">{r.file_name}</span>}
        {r.course_code && <span>{r.course_code}</span>}
        <span>Uploaded {ago(r.created_at)}</span>
        {r.attempts > 1 && <span>{r.attempts} attempts with this file</span>}
        <span>{STATUS_LABEL[r.review_status]}</span>
      </p>
      {r.error && <p className="mt-1 text-[12px] break-words text-danger">{r.error}</p>}
      {r.review_status === 'delivered' && r.delivery?.code && (
        <p className="mt-1 text-[12px] text-success">
          Added {r.delivery.assignment_ids?.length ?? 0} to {r.delivery.code}
          {r.delivery.created_course ? ' (new course)' : ''}
        </p>
      )}
      {r.resolution_note && <p className="mt-1 text-[12px] text-muted">Note sent: {r.resolution_note}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {r.has_file && (
          <button type="button" className={btn} onClick={() => void openStoredFile(r.user_id, r.id).catch((e: Error) => setNote(e.message))}>
            <FileText size={13} aria-hidden /> Open file
          </button>
        )}
        {r.review_status === 'queued' && (
          <>
            <button type="button" className={btn} onClick={() => setManual(true)}>
              <PenLine size={13} aria-hidden /> Parse manually
            </button>
            <button type="button" className={btn} onClick={() => setResolving((v) => !v)}>
              <CheckCircle2 size={13} aria-hidden /> Resolve with a note
            </button>
          </>
        )}
        {r.review_status === 'delivered' && (
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const u = await undoDelivery(r.id)
                return `Undone: removed ${u.removed}${u.course_removed ? ' and the course it created' : ''}. Back in the queue.`
              })
            }
          >
            <Undo2 size={13} aria-hidden /> Undo this delivery
          </button>
        )}
      </div>

      {resolving && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What the student is told, e.g. that file was a timetable, upload the outline"
            aria-label="Note to the student"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !text.trim()}
            className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast disabled:opacity-60"
            onClick={() =>
              void run(async () => {
                await resolveReview(r.id, text.trim())
                return 'Resolved. The student was sent your note.'
              })
            }
          >
            Resolve and notify
          </button>
        </div>
      )}
      {manual && (
        <ManualParseModal
          event={r}
          onClose={() => setManual(false)}
          onDone={(m) => {
            setNote(m)
            onChanged()
          }}
        />
      )}
      {note && (
        <p role="status" className="mt-1.5 text-[12px] text-muted">
          {note}
        </p>
      )}
    </li>
  )
}
