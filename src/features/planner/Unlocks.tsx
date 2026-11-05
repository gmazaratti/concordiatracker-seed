import { useEffect, useMemo, useState } from 'react'
import { EyeOff, GraduationCap, Loader2, X } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { browseCourses, type CatalogCourse } from '@/lib/catalog'
import { checkPrereq, describeTerm, normalizeCode, type Evaluation } from '@/lib/prereq'
import { canFilterBy, groupFor, type ProgramWithGroups } from '@/lib/program-progress'
import { cn } from '@/lib/cn'

type Row = { c: CatalogCourse; e: Evaluation; counts: string | null }

/**
 * What the record opens up.
 *
 * Reads Concordia's prerequisite prose properly (see lib/prereq.ts): ";" is
 * AND, " or " is OR, antirequisites exclude, and a credit floor is checked
 * against the credits you have. Where it cannot decide, it says so instead of
 * guessing.
 *
 * TWO WAYS TO NARROW IT (Mani's request: "I took general chem but I don't want
 * to see what that unlocks"):
 *   - Hide a SUBJECT you are not pursuing (CHEM), or a single course. Saved in
 *     `ui_state.plannerHidden`, so it follows you between devices, and always
 *     reversible from the line at the bottom.
 *   - "Only what counts toward my programme", when the programme's requirements
 *     are loaded. Each row that counts says which requirement it counts toward.
 */
export function Unlocks({
  completed,
  subjects,
  credits,
  program,
}: {
  completed: string[]
  subjects: string[]
  credits: number
  program: ProgramWithGroups | null
}) {
  const { uiState, patchUiState } = useUiState()
  const hidden = useMemo(
    () => ({
      subjects: new Set(uiState.plannerHidden?.subjects ?? []),
      courses: new Set(uiState.plannerHidden?.courses ?? []),
    }),
    [uiState.plannerHidden],
  )
  const filterable = canFilterBy(program)
  const [onlyMajor, setOnlyMajor] = useState(true)
  const narrowing = filterable && onlyMajor

  const [rows, setRows] = useState<CatalogCourse[] | null>(null)
  const scan = useMemo(() => subjects.filter((s) => !hidden.subjects.has(s)).slice(0, 6), [subjects, hidden])
  const scanKey = scan.join(',')

  useEffect(() => {
    let alive = true
    const list = scanKey ? scanKey.split(',') : []
    const run =
      list.length === 0
        ? Promise.resolve({ rows: [] as CatalogCourse[], total: 0 })
        : browseCourses({ subjects: list, limit: 400 })
    void run.then((r) => {
      if (alive) setRows(r.rows)
    })
    return () => {
      alive = false
    }
  }, [scanKey])

  const record = useMemo(
    () => ({ completed: new Set(completed.map(normalizeCode)), credits }),
    [completed, credits],
  )

  const groups = useMemo(() => {
    const done = new Set(completed.map(normalizeCode))
    const ready: Row[] = []
    const close: Row[] = []
    const unsure: Row[] = []
    for (const c of rows ?? []) {
      const code = c.subject + c.catalog
      if (done.has(normalizeCode(code))) continue
      if (hidden.courses.has(normalizeCode(code))) continue
      const counts = groupFor(program, `${c.subject} ${c.catalog}`)
      if (narrowing && !counts) continue
      const e = checkPrereq(c.prerequisites, record, code)
      // A course with no prerequisite at all was never locked: noise here.
      if (e.verdict === 'met' && e.unreadable) continue
      if (e.verdict === 'blocked') continue
      const row = { c, e, counts }
      if (e.verdict === 'met') ready.push(row)
      else if (e.verdict === 'unknown') unsure.push(row)
      else if (e.missing.length === 1) close.push(row)
    }
    // Courses that count toward the programme first.
    const byCounts = (a: Row, b: Row) => Number(!!b.counts) - Number(!!a.counts)
    return { ready: ready.sort(byCounts), close: close.sort(byCounts), unsure: unsure.sort(byCounts) }
  }, [rows, record, completed, hidden, program, narrowing])

  function setHidden(next: { subjects?: string[]; courses?: string[] }) {
    patchUiState({
      plannerHidden: {
        subjects: next.subjects ?? [...hidden.subjects],
        courses: next.courses ?? [...hidden.courses],
      },
    })
  }
  const toggleSubject = (s: string) =>
    setHidden({
      subjects: hidden.subjects.has(s) ? [...hidden.subjects].filter((x) => x !== s) : [...hidden.subjects, s],
    })
  const hideCourse = (c: CatalogCourse) =>
    setHidden({ courses: [...hidden.courses, normalizeCode(c.subject + c.catalog)] })

  const hiddenCount = hidden.subjects.size + hidden.courses.size

  return (
    <div>
      {subjects.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[12px] text-subtle">
            Subjects we read from your record. Tap one you are not pursuing to stop seeing what it unlocks.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => {
              const off = hidden.subjects.has(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSubject(s)}
                  aria-pressed={!off}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                    off
                      ? 'border-dashed border-border text-subtle line-through'
                      : 'border-accent/40 bg-accent-soft text-fg hover:border-accent',
                  )}
                >
                  {s}
                  {off ? <EyeOff size={11} aria-hidden /> : <X size={11} aria-hidden />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {filterable && program && (
        <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-[12.5px] text-fg">
          <input
            type="checkbox"
            checked={onlyMajor}
            onChange={(e) => setOnlyMajor(e.target.checked)}
            className="size-4 accent-[var(--ct-accent)]"
          />
          <GraduationCap size={14} className="text-accent" aria-hidden />
          Only what counts toward {program.name}
        </label>
      )}

      {rows === null ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : (
        <>
          <UnlockGroup title="You meet the prerequisites" rows={groups.ready} onHide={hideCourse} />
          <div className="mt-4">
            <UnlockGroup title="One requirement away" rows={groups.close} onHide={hideCourse} />
          </div>
          <div className="mt-4">
            <UnlockGroup title="Depends on something we cannot check" rows={groups.unsure} onHide={hideCourse} />
          </div>
        </>
      )}

      {hiddenCount > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-subtle">
          <EyeOff size={12} aria-hidden />
          {hidden.subjects.size > 0 && `${hidden.subjects.size} subject${hidden.subjects.size === 1 ? '' : 's'}`}
          {hidden.subjects.size > 0 && hidden.courses.size > 0 && ' and '}
          {hidden.courses.size > 0 && `${hidden.courses.size} course${hidden.courses.size === 1 ? '' : 's'}`} hidden.
          <button
            type="button"
            onClick={() => patchUiState({ plannerHidden: { subjects: [], courses: [] } })}
            className="font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Show everything again
          </button>
        </p>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-subtle">
        Prerequisites are read from the calendar text. Departments can still make exceptions, and course pages are
        the final word: check before you register.
      </p>
    </div>
  )
}

function UnlockGroup({ title, rows, onHide }: { title: string; rows: Row[]; onHide: (c: CatalogCourse) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-fg">
        {title}
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-subtle tabular-nums">
          {rows.length}
        </span>
      </h3>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-subtle">
          Nothing here yet.
        </p>
      ) : (
        <ul className="max-h-[40vh] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface">
          {rows.map(({ c, e, counts }) => (
            <li key={c.id}>
              <div className="flex items-center gap-1 pr-2 transition-colors duration-150 hover:bg-surface-2">
                <button
                  type="button"
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                  aria-expanded={open === c.id}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="text-[13px] font-semibold text-fg">
                        {c.subject} {c.catalog}
                      </span>
                      <span className="truncate text-[12px] text-subtle">{c.title}</span>
                    </span>
                    {counts && (
                      <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-accent">
                        <GraduationCap size={11} aria-hidden /> Counts toward {counts}
                      </span>
                    )}
                    {e.missing.length > 0 && (
                      <span className="mt-0.5 block text-[11.5px] text-warning">
                        Still need {e.missing.map(describeTerm).join('; ')}
                      </span>
                    )}
                    {e.verdict === 'unknown' && e.notes.length > 0 && (
                      <span className="mt-0.5 block truncate text-[11.5px] text-subtle">{e.notes[0]}</span>
                    )}
                  </span>
                  {c.class_unit !== null && (
                    <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">{c.class_unit} cr</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onHide(c)}
                  title="Not interested: hide this course"
                  aria-label={`Hide ${c.subject} ${c.catalog}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle hover:bg-surface hover:text-fg"
                >
                  <EyeOff size={14} aria-hidden />
                </button>
              </div>
              {open === c.id && (
                <p className="border-t border-border/60 bg-canvas/40 px-4 py-2.5 text-[12.5px] leading-relaxed text-muted">
                  {c.prerequisites || 'No prerequisite listed.'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
