import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ClipboardPaste, Loader2, Trash2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { GradeField } from '@/components/ui/GradeField'
import { useAppData } from '@/app/providers/app-data'
import { isNotation, parseFinalGrade, percentToGrade } from '@/lib/gpa'
import { parseTranscript, type ParsedRow } from '@/lib/transcript-parse'
import { cn } from '@/lib/cn'
import { allTerms, isUpcomingTerm } from './past-terms'

/**
 * Paste a transcript, check what was read, then save.
 *
 * Two steps on purpose. A paste is a GUESS about someone's academic record, and
 * an import that writes twenty courses straight in is one that quietly gets a
 * grade wrong and is never audited. So everything lands in an editable table
 * first, next to the line it came from, and nothing is written until the
 * student presses save.
 *
 * Rows the parser could not place are shown at the top rather than dropped,
 * because a silently missing course is the failure a student finds out about a
 * year later.
 */
export function PasteTranscriptModal({ onClose }: { onClose: () => void }) {
  const { addPastCourse } = useAppData()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [saving, setSaving] = useState(false)

  const parsed = useMemo(() => (text.trim() ? parseTranscript(text) : null), [text])

  function review() {
    if (!parsed) return
    setRows(parsed.rows)
  }

  const ready = (rows ?? []).filter((r) => r.term)
  const unplaced = (rows ?? []).filter((r) => !r.term)

  async function save() {
    setSaving(true)
    for (const r of ready) {
      const percent = r.grade ? parseFinalGrade(r.grade) : null
      await addPastCourse({
        code: r.code,
        title: r.title ?? '',
        term: r.term!,
        credits: r.credits ?? 3,
        archived: !isUpcomingTerm(r.term!),
        ...(percent === null
          ? {}
          : {
              finalPercent: percent,
              finalLetter: isNotation(r.grade!)
                ? r.grade!.trim().toUpperCase()
                : percentToGrade(percent).letter,
            }),
      })
    }
    setSaving(false)
    onClose()
  }

  const patch = (i: number, next: Partial<ParsedRow>) =>
    setRows((prev) => prev?.map((r, x) => (x === i ? { ...r, ...next } : r)) ?? null)

  return (
    <ModalShell label="Paste your courses" onClose={onClose} widthClass="sm:max-w-3xl">
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[18px] font-semibold text-fg">Paste your courses</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
          Copy your transcript or the course list from the Student Centre and paste it below. You
          will see exactly what was read before anything is saved.
        </p>

        {rows === null ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={
                'Fall 2025\nCOMM 217  Financial Accounting   3.00  C\nCOMM 214  Business Analytics     3.00  A+'
              }
              aria-label="Paste your transcript"
              className="mt-3 w-full rounded-lg border border-border bg-canvas px-3 py-2.5 font-mono text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            {parsed && (
              <p className="mt-1.5 text-[12px] text-subtle">
                {parsed.rows.length === 0
                  ? 'No course codes found yet.'
                  : `${parsed.rows.length} course${parsed.rows.length === 1 ? '' : 's'} found.`}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={review}
                disabled={!parsed || parsed.rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ClipboardPaste size={14} aria-hidden />
                Review {parsed?.rows.length ?? 0}
              </button>
            </div>
          </>
        ) : (
          <>
            {unplaced.length > 0 && (
              <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
                  <AlertTriangle size={13} className="text-warning" aria-hidden />
                  {unplaced.length} course{unplaced.length === 1 ? '' : 's'} without a term
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Pick a term for each below. They are not saved until you do, because guessing a
                  semester for someone&rsquo;s record is worse than asking.
                </p>
              </div>
            )}

            <ul className="mt-3 max-h-[46vh] space-y-2 overflow-y-auto">
              {rows.map((r, i) => (
                <li
                  key={`${r.code}-${i}`}
                  className={cn(
                    'rounded-lg border p-2.5',
                    r.term ? 'border-border bg-surface' : 'border-warning/50 bg-surface',
                  )}
                >
                  <div className="grid items-stretch gap-2 sm:grid-cols-[110px_1fr_150px_110px_auto]">
                    <span className="flex items-center text-[13px] font-semibold text-fg">
                      {r.code}
                    </span>
                    <input
                      value={r.title ?? ''}
                      onChange={(e) => patch(i, { title: e.target.value })}
                      placeholder="Course name"
                      aria-label={`Title for ${r.code}`}
                      className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
                    />
                    <Select
                      value={r.term ?? ''}
                      onChange={(t) => patch(i, { term: t })}
                      ariaLabel={`Term for ${r.code}`}
                      placeholder="Pick a term"
                      size="sm"
                      options={allTerms().map((t) => ({
                        value: t,
                        label: isUpcomingTerm(t) ? `${t} · upcoming` : t,
                      }))}
                    />
                    <GradeField
                      value={r.grade ?? ''}
                      onChange={(g) => patch(i, { grade: g })}
                      ariaLabel={`Grade for ${r.code}`}
                    />
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev?.filter((_, x) => x !== i) ?? null)}
                      aria-label={`Remove ${r.code}`}
                      className="grid size-8 place-items-center self-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </div>
                  {/* The line it came from, so a misread is obvious rather than
                      something to take on trust. */}
                  <p className="mt-1 truncate font-mono text-[10.5px] text-subtle">{r.source}</p>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-[12px] text-subtle">
                {ready.length} of {rows.length} ready to save
              </span>
              <button
                type="button"
                onClick={() => setRows(null)}
                className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
              >
                Back to paste
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={ready.length === 0 || saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Check size={14} aria-hidden />
                )}
                Save {ready.length}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
