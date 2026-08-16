import { useEffect, useState } from 'react'
import { Check, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { useAppData } from '@/app/providers/app-data'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import { GRADE_LETTERS, parseFinalGrade, percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'
import { pastTerms } from './past-terms'

/**
 * Add a whole semester at once.
 *
 * Entering courses one at a time meant re-picking the term for every row, which
 * is the wrong shape for the actual task: nobody remembers one course from
 * three years ago, they remember a semester. So the term is chosen ONCE at the
 * top and every row below inherits it, and nothing is written until Save, so a
 * half-finished semester can be abandoned without leaving debris.
 *
 * Grades accept a letter or a percentage, because a transcript shows letters
 * and making someone convert B+ to 77 by hand is both friction and a source of
 * error.
 */

interface Draft {
  key: string
  course: CatalogCourse | null
  /** What they typed, kept raw so the field never fights the person typing. */
  query: string
  grade: string
}

let seq = 0
const blank = (): Draft => ({ key: `d${seq++}`, course: null, query: '', grade: '' })

export function ImportSemesterModal({ onClose }: { onClose: () => void }) {
  const { addPastCourse } = useAppData()
  const [term, setTerm] = useState(pastTerms()[1] ?? pastTerms()[0])
  const [rows, setRows] = useState<Draft[]>([blank(), blank(), blank()])
  const [saving, setSaving] = useState(false)

  const ready = rows.filter((r) => r.course !== null)
  const badGrade = rows.some((r) => r.grade.trim() !== '' && parseFinalGrade(r.grade) === null)

  const patch = (key: string, next: Partial<Draft>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)))

  async function save() {
    if (ready.length === 0 || badGrade) return
    setSaving(true)
    // Sequential rather than parallel: each insert returns a row the provider
    // folds into state, and a burst of concurrent writes makes the list order
    // depend on which request happens to land first.
    for (const r of ready) {
      if (!r.course) continue
      const percent = r.grade.trim() === '' ? null : parseFinalGrade(r.grade)
      await addPastCourse({
        code: `${r.course.subject} ${r.course.catalog}`,
        title: r.course.title,
        term,
        credits: r.course.class_unit ?? 3,
        ...(percent === null ? {} : { finalPercent: percent }),
      })
    }
    setSaving(false)
    onClose()
  }

  return (
    <ModalShell label="Import a semester" onClose={onClose} widthClass="sm:max-w-2xl">
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[18px] font-semibold text-fg">Import a semester</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
          Pick the term once, then add every class you took. Grades are optional and can be a letter
          or a percentage.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-[12.5px] font-medium text-fg" htmlFor="import-term">
            Term
          </label>
          <div className="w-48">
            <Select
              value={term}
              onChange={setTerm}
              ariaLabel="Term for every course below"
              options={pastTerms(24).map((x) => ({ value: x, label: x }))}
            />
          </div>
          <span className="text-[12px] text-subtle">applies to every row</span>
        </div>

        <ul className="mt-4 space-y-2">
          {rows.map((row, i) => (
            <DraftRow
              key={row.key}
              row={row}
              index={i}
              canRemove={rows.length > 1}
              onChange={(next) => patch(row.key, next)}
              onRemove={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
              onEnter={() => setRows((prev) => [...prev, blank()])}
            />
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, blank()])}
          className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:text-accent"
        >
          <Plus size={13} aria-hidden />
          Add another class
        </button>

        {badGrade && (
          <p className="mt-3 text-[12px] text-danger">
            A grade must be a percentage (0 to 100) or a letter like A-, B+ or C.
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <span className="mr-auto text-[12px] text-subtle">
            {ready.length === 0
              ? 'Pick at least one class'
              : `${ready.length} class${ready.length === 1 ? '' : 'es'} ready`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={ready.length === 0 || badGrade || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Check size={14} aria-hidden />
            )}
            {saving
              ? 'Adding'
              : ready.length === 0
                ? `Add to ${term}`
                : `Add ${ready.length} to ${term}`}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function DraftRow({
  row,
  index,
  canRemove,
  onChange,
  onRemove,
  onEnter,
}: {
  row: Draft
  index: number
  canRemove: boolean
  onChange: (next: Partial<Draft>) => void
  onRemove: () => void
  onEnter: () => void
}) {
  const [hits, setHits] = useState<CatalogCourse[] | null>(null)

  useEffect(() => {
    const needle = row.query.trim()
    if (row.course || !needle) return
    let alive = true
    const id = window.setTimeout(() => {
      void searchCourses(needle, 6)
        .then((r) => alive && setHits(r))
        .catch(() => alive && setHits([]))
    }, 200)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [row.query, row.course])

  const percent = row.grade.trim() === '' ? null : parseFinalGrade(row.grade)
  const letter = percent === null ? null : percentToGrade(percent).letter

  return (
    <li className="relative">
      <div className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
        <div className="relative">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
          />
          <input
            value={row.course ? `${row.course.subject} ${row.course.catalog} · ${row.course.title}` : row.query}
            onChange={(e) => {
              onChange({ course: null, query: e.target.value })
              if (!e.target.value.trim()) setHits(null)
            }}
            placeholder={`Class ${index + 1}`}
            aria-label={`Class ${index + 1}`}
            className="w-full rounded-lg border border-border bg-canvas py-2 pr-3 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>

        <div className="relative">
          <input
            value={row.grade}
            onChange={(e) => onChange({ grade: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEnter()
            }}
            list={`letters-${row.key}`}
            placeholder="Grade"
            aria-label={`Grade for class ${index + 1}, optional`}
            className={cn(
              'w-full rounded-lg border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:outline-none',
              row.grade.trim() !== '' && percent === null
                ? 'border-danger'
                : 'border-border focus:border-accent',
            )}
          />
          <datalist id={`letters-${row.key}`}>
            {GRADE_LETTERS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          {/* Typing 87 and seeing "A" confirms the scale being applied, which
              matters when someone is entering a dozen of them in a row. */}
          {letter && !/^[A-Za-z]/.test(row.grade.trim()) && (
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] font-medium text-subtle">
              {letter}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove class ${index + 1}`}
          className="grid size-9 shrink-0 place-items-center self-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-danger disabled:opacity-30"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>

      {!row.course && hits !== null && hits.length > 0 && row.query.trim() !== '' && (
        <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg sm:w-[calc(100%-150px)]">
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ course: c, query: '' })
                  setHits(null)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <span className="shrink-0 text-[12.5px] font-semibold text-fg">
                  {c.subject} {c.catalog}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-subtle">{c.title}</span>
                {c.class_unit !== null && (
                  <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">
                    {c.class_unit} cr
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
