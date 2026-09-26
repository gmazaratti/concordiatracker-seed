import { useEffect, useState } from 'react'
import { FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { KIND_LABEL } from '@/lib/assessment'
import { supabase } from '@/lib/supabase'
import { term } from '@/data/mock'
import { openStoredFile, type ParseEvent } from './parse-data'

type Target = Pick<
  ParseEvent,
  'id' | 'user_id' | 'course_code' | 'name' | 'handle' | 'email' | 'has_file'
>

interface Preview {
  course_exists: boolean
  course_title: string | null
  credits: number | null
  term: string
  will_add: string[]
  duplicates_skipped: string[]
  weight_total: number
  undated: number
}

interface Item {
  title: string
  kind: string
  due: string | null
  weight: string
}

const KINDS = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))
const blank = (): Item => ({ title: '', kind: 'assignment', due: null, weight: '' })

/**
 * Parse a student's syllabus by hand and put it straight into their course.
 *
 * For the upload the parser got wrong or could not read at all: open the
 * file, type or fix the assessments, deliver. admin_deliver_parse
 * (db/parse_uploads.sql) adds them to that student's course for the term
 * (creating it if needed, never duplicating an item already there), marks
 * the upload delivered, and tells the student. Everything lands Unverified,
 * like any syllabus the student uploads themselves.
 *
 * Two steps on purpose: nothing is written until the preview has shown which
 * course it lands in (existing or new), what will be added and what is
 * skipped as already there (parse_delivery_preview, db/parse_review.sql).
 * A delivery can be undone from the review queue if it was wrong.
 */
export function ManualParseModal({
  event,
  onClose,
  onDone,
}: {
  event: Target
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [code, setCode] = useState(event.course_code ?? '')
  const [title, setTitle] = useState('')
  const [termName, setTermName] = useState(term.name)
  const [items, setItems] = useState<Item[]>([blank()])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)

  // Pre-fill from a Retry, when there was one: fixing beats retyping.
  useEffect(() => {
    let alive = true
    void supabase.rpc('admin_parse_retry_result', { p_event: event.id }).then(({ data }) => {
      if (!alive) return
      const r = data as {
        course?: { code?: string; title?: string }
        assessments?: {
          title?: string
          kind?: string
          due?: string | null
          weight?: number | null
        }[]
      } | null
      if (r?.course?.code) setCode(r.course.code)
      if (r?.course?.title) setTitle(r.course.title)
      if (r?.assessments?.length) {
        setItems(
          r.assessments.map((a) => ({
            title: a.title ?? '',
            kind: a.kind && a.kind in KIND_LABEL ? a.kind : 'assignment',
            due: a.due ?? null,
            weight: a.weight != null ? String(a.weight) : '',
          })),
        )
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [event.id])

  const set = (i: number, patch: Partial<Item>) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const who = event.name || (event.handle ? `@${event.handle}` : event.email) || 'this student'
  const total = items.reduce((n, it) => n + (Number(it.weight) || 0), 0)
  const ready = code.trim() && termName.trim() && items.some((it) => it.title.trim())

  const payload = () =>
    items
      .filter((it) => it.title.trim())
      .map((it) => ({
        title: it.title.trim(),
        kind: it.kind,
        due: it.due,
        weight: it.weight === '' ? null : Number(it.weight),
      }))

  async function check() {
    setBusy(true)
    setErr('')
    const { data, error } = await supabase.rpc('parse_delivery_preview', {
      p_event: event.id,
      p_code: code,
      p_term: termName,
      p_items: payload(),
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setPreview(data as Preview)
  }

  async function deliver() {
    setBusy(true)
    setErr('')
    const { data, error } = await supabase.rpc('admin_deliver_parse', {
      p_event: event.id,
      p_code: code,
      p_title: title,
      p_term: termName,
      p_items: payload(),
    })
    setBusy(false)
    if (error) return setErr(error.message)
    const r = data as { added: number; created_course: boolean }
    onDone(
      `Delivered ${r.added} assessment${r.added === 1 ? '' : 's'} to ${code.trim().toUpperCase()}${r.created_course ? ' (new course)' : ''}. The student was notified.`,
    )
    onClose()
  }

  const field =
    'w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <ModalShell label="Parse manually" onClose={onClose} widthClass="sm:max-w-3xl">
      <div className="p-4 pr-14 sm:p-5 sm:pr-14">
        <h2 className="text-[17px] font-semibold text-fg">Parse manually for {who}</h2>
        <p className="mt-0.5 text-[12.5px] text-subtle">
          Goes straight into their course for that term, marked Unverified. Items already on their
          list are skipped.
        </p>
        {event.has_file && (
          <button
            type="button"
            onClick={() =>
              void openStoredFile(event.user_id, event.id).catch((e: Error) => setErr(e.message))
            }
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            <FileText size={13} aria-hidden /> Open their file
          </button>
        )}

        {!preview && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_1fr]">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Course code, e.g. COMM 305"
                aria-label="Course code"
                className={field}
              />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Course title (optional; the catalogue fills it)"
                aria-label="Course title"
                className={field}
              />
              <input
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                placeholder="Term, e.g. Fall 2026"
                aria-label="Term"
                className={field}
              />
            </div>

            {loading ? (
              <div className="grid place-items-center py-8">
                <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
              </div>
            ) : (
              <ul className="mt-4 flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.6fr_1fr_1.4fr_0.6fr_auto] sm:items-center"
                  >
                    <input
                      value={it.title}
                      onChange={(e) => set(i, { title: e.target.value })}
                      placeholder="Title"
                      aria-label="Title"
                      className={field}
                    />
                    <Select
                      value={it.kind}
                      onChange={(v) => set(i, { kind: v })}
                      options={KINDS}
                      ariaLabel="Kind"
                      size="sm"
                    />
                    <DateTimePicker
                      value={it.due}
                      onChange={(v) => set(i, { due: v })}
                      ariaLabel="Due date"
                      clearable
                    />
                    <input
                      value={it.weight}
                      onChange={(e) => set(i, { weight: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="%"
                      aria-label="Weight"
                      inputMode="decimal"
                      className={field}
                    />
                    <button
                      type="button"
                      onClick={() => setItems((l) => l.filter((_, j) => j !== i))}
                      aria-label="Remove"
                      className="grid size-8 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setItems((l) => [...l, blank()])}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
              >
                <Plus size={13} aria-hidden /> Add an assessment
              </button>
              <span
                className={total === 100 ? 'text-[12px] text-success' : 'text-[12px] text-warning'}
              >
                Weights total {total}%
              </span>
            </div>
          </>
        )}
        {preview && <PreviewCard p={preview} code={code} who={who} />}
        {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={preview ? () => setPreview(null) : onClose}>
            {preview ? 'Back to editing' : 'Cancel'}
          </Button>
          {preview ? (
            <Button disabled={busy || preview.will_add.length === 0} onClick={() => void deliver()}>
              {busy ? 'Adding…' : `Add ${preview.will_add.length} to their courses`}
            </Button>
          ) : (
            <Button disabled={!ready || busy} onClick={() => void check()}>
              {busy ? 'Checking…' : 'Check before adding'}
            </Button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function PreviewCard({ p, code, who }: { p: Preview; code: string; who: string }) {
  const off = Math.round(p.weight_total) !== 100
  return (
    <div
      className="mt-3 rounded-lg border border-accent/40 bg-accent-soft p-3 text-[12.5px] text-fg"
      role="status"
    >
      <p className="font-semibold">
        {p.course_exists
          ? `Goes into ${who}'s existing ${code.trim().toUpperCase()} (${p.term}).`
          : `Creates ${code.trim().toUpperCase()}${p.course_title ? ` · ${p.course_title}` : ''} for ${who} in ${p.term}${p.credits != null ? `, ${p.credits} credits` : ''}.`}
      </p>
      <p className="mt-1 text-muted">
        Adds {p.will_add.length}: {p.will_add.join(', ') || 'nothing'}
      </p>
      {p.duplicates_skipped.length > 0 && (
        <p className="mt-0.5 text-muted">
          Skips {p.duplicates_skipped.length} already on their list:{' '}
          {p.duplicates_skipped.join(', ')}
        </p>
      )}
      {(off || p.undated > 0) && (
        <p className="mt-1 text-warning">
          {off ? `Weights total ${p.weight_total}%, not 100. ` : ''}
          {p.undated > 0 ? `${p.undated} without a date.` : ''}
        </p>
      )}
    </div>
  )
}
