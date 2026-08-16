import { useEffect, useMemo, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { Select } from '@/components/ui/Select'
import { ProgramPicker } from '@/components/ui/ProgramPicker'
import { percentToGrade } from '@/lib/gpa'
import { sortTermsDesc } from '@/lib/term'
import {
  loadAcademicProfile,
  prereqProgress,
  saveAcademicProfile,
  summarizeRecord,
  type PrereqProgress,
} from '@/lib/academic-record'
import { cn } from '@/lib/cn'
import { YEARS } from './past-terms'
import { PastCourseEntry } from './PastCourseEntry'

/**
 * Your record, and what it opens up.
 *
 * Three questions in order: where are you, what have you done, what does that
 * unlock. The first two are entry, the third is the payoff, and the payoff is
 * deliberately careful about what it claims.
 */
export function MyRecordPanel() {
  const { pastCourses, assessments, user, setProgram, removeCourse } = useAppData()
  const [year, setYear] = useState<number | null>(null)
  const [minor, setMinor] = useState('')
  const [loaded, setLoaded] = useState(false)

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

  return (
    <div className="space-y-6">
      <section>
        <SectionHead
          n={1}
          title="Where you are"
          sub="Used to decide which subjects to scan for what you can take next."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Year of study">
            <Select
              value={year === null ? '' : String(year)}
              onChange={(v) => {
                const n = Number(v)
                setYear(n)
                void saveAcademicProfile({ yearOfStudy: n })
              }}
              ariaLabel="Year of study"
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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
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
      </section>

      <section>
        <SectionHead
          n={2}
          title="What you have finished"
          sub="Grades are optional. Without them a course still counts for credits and prerequisites, it just does not move your GPA."
        />
        <PastCourseEntry />

        {pastCourses.length > 0 && (
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
                      {typeof c.finalPercent === 'number'
                        ? percentToGrade(c.finalPercent).letter
                        : <span className="text-subtle">&mdash;</span>}
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
      </section>

      <section>
        <SectionHead n={3} title="Where that leaves you" sub="" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Credits done" value={String(summary.credits)} />
          <Stat
            label="Courses"
            value={String(summary.courseCount)}
          />
          <Stat
            label="GPA"
            value={summary.gpa === null ? '—' : summary.gpa.toFixed(2)}
            // A GPA over a third of a degree is not a GPA over the degree.
            // Saying what it covers costs one line and prevents a wrong belief.
            note={
              summary.gpa === null
                ? 'Add a grade to see it'
                : `over ${summary.gradedCredits} graded credits`
            }
          />
          <Stat
            label="Subjects"
            value={String(summary.subjects.length)}
            note={summary.subjects.slice(0, 3).join(' · ')}
          />
        </div>
      </section>

      <Unlocks completed={summary.completedCodes} subjects={summary.subjects} />
    </div>
  )
}

/**
 * What the record opens up.
 *
 * The claim is precisely "every course named in the prerequisite is done", not
 * "you are eligible". Concordia writes prerequisites as prose: an "or" clause
 * may need only one of the codes, minimum grades are common, and some read
 * "written permission of the department". So the original sentence is always
 * one click away, and the caveat is stated rather than buried.
 */
function Unlocks({ completed, subjects }: { completed: string[]; subjects: string[] }) {
  const [rows, setRows] = useState<PrereqProgress[] | null>(null)
  const scan = useMemo(() => subjects.slice(0, 6), [subjects])

  useEffect(() => {
    let alive = true
    // Nothing to scan resolves to an empty list through the same async path,
    // so the effect never sets state synchronously.
    const run = completed.length === 0 || scan.length === 0
      ? Promise.resolve([] as PrereqProgress[])
      : prereqProgress(completed, scan)
    void run.then((r) => {
      if (alive) setRows(r)
    })
    return () => {
      alive = false
    }
  }, [completed, scan])

  if (completed.length === 0) {
    return (
      <section>
        <SectionHead n={4} title="What that unlocks" sub="" />
        <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-[13px] text-subtle">
          Add the courses you have finished and this fills in.
        </p>
      </section>
    )
  }

  if (rows === null) {
    return (
      <section>
        <SectionHead n={4} title="What that unlocks" sub="" />
        <div className="grid place-items-center py-10">
          <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
        </div>
      </section>
    )
  }

  const ready = rows.filter((r) => r.missing.length === 0)
  const oneAway = rows.filter((r) => r.missing.length === 1)

  return (
    <section>
      <SectionHead
        n={4}
        title="What that unlocks"
        sub={`Scanning ${scan.join(', ')} — the subjects you have taken most.`}
      />

      <p className="mb-3 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted">
        Concordia writes prerequisites as sentences, so this checks which
        <strong className="font-medium text-fg"> courses named</strong> in them you have finished.
        It does not read the and/or logic or minimum grades, so treat it as a shortlist and check
        the sentence before you register.
      </p>

      <UnlockGroup
        title="Everything named is done"
        empty="Nothing here yet."
        rows={ready}
      />
      <div className="mt-4">
        <UnlockGroup
          title="One course away"
          empty="Nothing here yet."
          rows={oneAway}
        />
      </div>
    </section>
  )
}

function UnlockGroup({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: PrereqProgress[]
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
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
                aria-expanded={open === r.id}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="text-[13px] font-semibold text-fg">
                      {r.subject} {r.catalog}
                    </span>
                    <span className="truncate text-[12px] text-subtle">{r.title}</span>
                  </span>
                  {r.missing.length > 0 && (
                    <span className="mt-0.5 block text-[11.5px] text-warning">
                      Still need {r.missing.join(', ')}
                    </span>
                  )}
                </span>
                {r.class_unit !== null && (
                  <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">
                    {r.class_unit} cr
                  </span>
                )}
              </button>
              {open === r.id && (
                <p className="border-t border-border/60 bg-canvas/40 px-4 py-2.5 text-[12.5px] leading-relaxed text-muted">
                  {r.prerequisites}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SectionHead({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <header className="mb-2.5">
      <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold text-fg">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">
          {n}
        </span>
        {title}
      </h2>
      {sub && <p className="mt-0.5 pl-7 text-[12.5px] leading-relaxed text-subtle">{sub}</p>}
    </header>
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
