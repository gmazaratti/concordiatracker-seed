import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Loader2, Trash2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { Select } from '@/components/ui/Select'
import { ProgramPicker } from '@/components/ui/ProgramPicker'
import { percentToGrade } from '@/lib/gpa'
import { sortTermsDesc } from '@/lib/term'
import {
  loadAcademicProfile,
  saveAcademicProfile,
  summarizeRecord,
} from '@/lib/academic-record'
import { browseCourses, type CatalogCourse } from '@/lib/catalog'
import { checkPrereq, describeTerm, normalizeCode, type Evaluation } from '@/lib/prereq'
import { cn } from '@/lib/cn'
import { Step } from './Step'
import { YEARS } from './past-terms'
import { PastCourseEntry } from './PastCourseEntry'
import { ImportSemesterModal } from './ImportSemesterModal'

/**
 * Your record, and what it opens up.
 *
 * Presented as steps rather than four equal sections, because the sections all
 * carried the same weight and there was nowhere obvious to look. A finished step
 * recedes to a tick, the one you are on is the only thing with contrast, and a
 * step that cannot run yet says what would unlock it instead of showing an empty
 * result and letting you wonder whether it is broken.
 */
export function MyRecordPanel() {
  const { pastCourses, assessments, user, setProgram, removeCourse } = useAppData()
  const [year, setYear] = useState<number | null>(null)
  const [minor, setMinor] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    let alive = true
    void loadAcademicProfile().then((p) => {
      if (!alive) return
      setYear(p.yearOfStudy)
      setMinor(p.minor ?? '')
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const summary = useMemo(
    () => summarizeRecord(pastCourses, assessments),
    [pastCourses, assessments],
  )

  // A step counts as done once it has what the NEXT step needs, not once it is
  // complete: the minor is optional and nothing downstream reads it.
  const knowsWhere = year !== null && !!user.program
  const hasHistory = pastCourses.length > 0

  return (
    <div>
      <Step
        n={1}
        title="Where you are"
        sub="Decides which subjects get scanned for what you can take next."
        state={knowsWhere ? 'done' : 'active'}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What year are you in right now?">
            <Select
              value={year === null ? '' : String(year)}
              onChange={(v) => {
                const n = Number(v)
                setYear(n)
                void saveAcademicProfile({ yearOfStudy: n })
              }}
              ariaLabel="What year are you in right now"
              placeholder={loaded ? 'Choose a year' : 'Loading'}
              options={YEARS.map((y) => ({ value: String(y.value), label: y.label }))}
            />
          </Field>

          <Field label="Minor (optional)">
            <input
              value={minor}
              onChange={(e) => setMinor(e.target.value)}
              onBlur={() => void saveAcademicProfile({ minor: minor.trim() || null })}
              placeholder="e.g. Economics"
              aria-label="Minor"
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Major">
              <ProgramPicker
                size="sm"
                value={user.program ? { id: 'existing', name: user.program } : null}
                onChange={(sel) => setProgram(sel)}
              />
            </Field>
          </div>
        </div>
      </Step>

      <Step
        n={2}
        title="What you have finished"
        sub="Grades are optional. Without one a course still counts for credits and prerequisites, it just does not move your GPA."
        state={hasHistory ? 'done' : 'active'}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-subtle">Add one class, or bring in a whole term at once.</p>
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
          >
            <CalendarPlus size={13} aria-hidden />
            Import a semester
          </button>
        </div>
        <PastCourseEntry />
        {hasHistory && (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {sortTermsDesc([...new Set(pastCourses.map((c) => c.term))]).flatMap((term) => [
              <li
                key={`h-${term}`}
                className="bg-surface-2 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase"
              >
                {term}
              </li>,
              ...pastCourses
                .filter((c) => c.term === term)
                .map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="text-[13.5px] font-medium text-fg">{c.code}</span>
                      {c.title && (
                        <span className="ml-2 truncate text-[12px] text-subtle">{c.title}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[12px] text-subtle tabular-nums">
                      {c.credits} cr
                    </span>
                    <span className="w-14 shrink-0 text-right text-[13px] font-medium text-fg">
                      {typeof c.finalPercent === 'number' ? (
                        percentToGrade(c.finalPercent).letter
                      ) : (
                        <span className="text-subtle">&mdash;</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCourse(c.id)}
                      aria-label={`Remove ${c.code}`}
                      className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </li>
                )),
            ])}
          </ul>
        )}
      </Step>

      <Step
        n={3}
        title="Where that leaves you"
        state={hasHistory ? 'active' : 'locked'}
        lockedReason="Add a finished course above and your credits, GPA and subjects appear here."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Credits done" value={String(summary.credits)} />
          <Stat label="Courses" value={String(summary.courseCount)} />
          <Stat
            label="GPA"
            value={summary.gpa === null ? '\u2014' : summary.gpa.toFixed(2)}
            note={
              summary.gpa === null
                ? 'Add a grade to see it'
                : `over ${summary.gradedCredits} graded credits`
            }
          />
          <Stat
            label="Subjects"
            value={String(summary.subjects.length)}
            note={summary.subjects.slice(0, 3).join(' \u00b7 ')}
          />
        </div>
      </Step>

      <Step
        n={4}
        title="What that unlocks"
        state={hasHistory ? 'active' : 'locked'}
        lockedReason="Once we know what you have finished, this reads the prerequisites for your subjects and tells you what you can take."
        last
      >
        <Unlocks
          completed={summary.completedCodes}
          subjects={summary.subjects}
          credits={summary.credits}
        />
      </Step>

      {importing && <ImportSemesterModal onClose={() => setImporting(false)} />}
    </div>
  )
}

/**
 * What the record opens up.
 *
 * This reads Concordia's prerequisite prose properly (see lib/prereq.ts): ";"
 * is AND, " or " is OR, antirequisites exclude, and a credit floor is checked
 * against the credits you have. So it answers the actual question — can I take
 * this — rather than the weaker one it used to answer.
 *
 * Where it genuinely cannot decide, it says so instead of guessing. "Permission
 * of the Department" and "or equivalent" both hinge on something we cannot see,
 * and those land in their own group rather than being silently counted as a yes
 * or a no.
 */
function Unlocks({
  completed,
  subjects,
  credits,
}: {
  completed: string[]
  subjects: string[]
  credits: number
}) {
  const [rows, setRows] = useState<CatalogCourse[] | null>(null)
  const scan = useMemo(() => subjects.slice(0, 6), [subjects])

  useEffect(() => {
    let alive = true
    const run =
      scan.length === 0
        ? Promise.resolve({ rows: [] as CatalogCourse[], total: 0 })
        : browseCourses({ subjects: scan, limit: 400 })
    void run.then((r) => {
      if (alive) setRows(r.rows)
    })
    return () => {
      alive = false
    }
  }, [scan])

  const record = useMemo(
    () => ({ completed: new Set(completed.map(normalizeCode)), credits }),
    [completed, credits],
  )

  const groups = useMemo(() => {
    const done = new Set(completed.map(normalizeCode))
    const ready: { c: CatalogCourse; e: Evaluation }[] = []
    const close: { c: CatalogCourse; e: Evaluation }[] = []
    const unsure: { c: CatalogCourse; e: Evaluation }[] = []
    for (const c of rows ?? []) {
      // Nothing you have already finished.
      if (done.has(normalizeCode(c.subject + c.catalog))) continue
      const e = checkPrereq(c.prerequisites, record)
      // A course with no prerequisite at all is true but not interesting: it
      // was never locked, so listing it as "unlocked" is noise.
      if (e.verdict === 'met' && e.unreadable) continue
      if (e.verdict === 'blocked') continue
      if (e.verdict === 'met') ready.push({ c, e })
      else if (e.verdict === 'unknown') unsure.push({ c, e })
      else if (e.missing.length === 1) close.push({ c, e })
    }
    return { ready, close, unsure }
  }, [rows, record, completed])

  if (rows === null) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
      </div>
    )
  }

  return (
    <div>
      <p className="mb-3 text-[12.5px] text-subtle">
        Reading the prerequisites for {scan.join(', ')} against your record.
      </p>

      <UnlockGroup
        title="You meet the prerequisites"
        empty="Nothing here yet."
        rows={groups.ready}
      />
      <div className="mt-4">
        <UnlockGroup title="One requirement away" empty="Nothing here yet." rows={groups.close} />
      </div>
      <div className="mt-4">
        <UnlockGroup
          title="Depends on something we cannot check"
          empty="Nothing here yet."
          rows={groups.unsure}
        />
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-subtle">
        Prerequisites are read from the calendar text. Departments can still make
        exceptions, and course pages are the final word: check before you register.
      </p>
    </div>
  )
}

function UnlockGroup({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: { c: CatalogCourse; e: Evaluation }[]
}) {
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
          {empty}
        </p>
      ) : (
        <ul className="max-h-[40vh] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface">
          {rows.map(({ c, e }) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpen(open === c.id ? null : c.id)}
                aria-expanded={open === c.id}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="text-[13px] font-semibold text-fg">
                      {c.subject} {c.catalog}
                    </span>
                    <span className="truncate text-[12px] text-subtle">{c.title}</span>
                  </span>
                  {e.missing.length > 0 && (
                    <span className="mt-0.5 block text-[11.5px] text-warning">
                      Still need {e.missing.map(describeTerm).join('; ')}
                    </span>
                  )}
                  {e.verdict === 'unknown' && e.notes.length > 0 && (
                    <span className="mt-0.5 block truncate text-[11.5px] text-subtle">
                      {e.notes[0]}
                    </span>
                  )}
                </span>
                {c.class_unit !== null && (
                  <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">
                    {c.class_unit} cr
                  </span>
                )}
              </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-subtle">{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface px-3.5 py-3')}>
      <p className="text-[11px] tracking-wide text-subtle uppercase">{label}</p>
      <p className="mt-0.5 font-display text-[22px] leading-none font-semibold text-fg tabular-nums">
        {value}
      </p>
      {note && <p className="mt-1 text-[11px] leading-snug text-subtle">{note}</p>}
    </div>
  )
}
