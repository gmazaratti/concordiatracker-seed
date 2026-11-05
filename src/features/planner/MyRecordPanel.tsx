import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ClipboardPaste, ListChecks, Share2, ShieldCheck } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { Select } from '@/components/ui/Select'
import { ProgramPicker } from '@/components/ui/ProgramPicker'
import { supersededCourseIds } from '@/lib/gpa'
import { sortTermsDesc } from '@/lib/term'
import {
  loadAcademicProfile,
  saveAcademicProfile,
  summarizeRecord,
} from '@/lib/academic-record'
import { cn } from '@/lib/cn'
import { GpaBreakdown } from './GpaBreakdown'
import { useShownGpa } from '@/app/hooks/useShownGpa'
import { PastCourseRow } from './PastCourseRow'
import { Step } from './Step'
import { YEARS } from './past-terms'
import { PastCourseEntry } from './PastCourseEntry'
import { ImportSemesterModal } from './ImportSemesterModal'
import { PasteTranscriptModal } from './PasteTranscriptModal'
import { RecordSheet } from './RecordSheet'
import { useRecordSnapshot } from './useRecordSnapshot'
import { Unlocks } from './Unlocks'
import { CoopCard } from './CoopCard'
import { useProgramForUser } from './useProgramForUser'

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
  const { pastCourses, assessments, user, setProgram } = useAppData()
  const program = useProgramForUser()
  const [year, setYear] = useState<number | null>(null)
  const [minor, setMinor] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [importing, setImporting] = useState(false)
  // A term name pre-selects the importer, so adding to an existing semester
  // does not mean choosing it again.
  const [importTerm, setImportTerm] = useState<string | null>(null)
  const [recordComplete, setRecordComplete] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const snapshot = useRecordSnapshot()

  useEffect(() => {
    let alive = true
    void loadAcademicProfile().then((p) => {
      if (!alive) return
      setYear(p.yearOfStudy)
      setMinor(p.minor ?? '')
      setRecordComplete(p.recordComplete)
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

  // Presentation only, admin only, and it never writes — see lib/demo-gpa.ts.
  const shownGpa = useShownGpa()(summary.gpa)
  const superseded = useMemo(
    () => supersededCourseIds(pastCourses, assessments),
    [pastCourses, assessments],
  )

  // A step counts as done once it has what the NEXT step needs, not once it is
  // complete: the minor is optional and nothing downstream reads it.
  const knowsWhere = year !== null && !!user.program
  const hasHistory = pastCourses.length > 0

  return (
    <div>
      {/* Export sits at the TOP, not buried under step four. A record you can
          only read inside the app is a record that has to be retyped into
          every advising form and every scholarship application — and the
          moment you want it is the moment you are looking at it. Hidden until
          there is something to export, because a button that produces an empty
          sheet is worse than no button. */}
      {hasHistory && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5">
          <p className="min-w-0 text-[12.5px] text-subtle">
            {summary.credits} {summary.credits === 1 ? 'credit' : 'credits'} · {summary.courseCount}{' '}
            {summary.courseCount === 1 ? 'course' : 'courses'}
            {shownGpa === null ? '' : ` · GPA ${shownGpa.toFixed(2)}`}
          </p>
          <button
            type="button"
            onClick={() => setExporting(true)}
            disabled={!snapshot}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg disabled:opacity-60"
          >
            <Share2 size={13} aria-hidden />
            Export or share
          </button>
        </div>
      )}

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
          <span className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPasting(true)}
              title="Paste your transcript and confirm what was read"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              <ClipboardPaste size={13} aria-hidden />
              Paste my courses
            </button>
            <button
              type="button"
              onClick={() => setImporting(true)}
              title="Add a term one course at a time"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
            >
              <CalendarPlus size={13} aria-hidden />
              Import a semester
            </button>
          </span>
        </div>
        <PastCourseEntry />
        {hasHistory && (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {sortTermsDesc([...new Set(pastCourses.map((c) => c.term))]).flatMap((term) => [
              <li
                key={`h-${term}`}
                className="flex items-center justify-between gap-2 bg-surface-2 px-4 py-1.5"
              >
                <span className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                  {term}
                </span>
                <button
                  type="button"
                  onClick={() => setImportTerm(term)}
                  className="text-[11px] font-medium text-subtle transition-colors duration-150 hover:text-accent"
                >
                  + Add a class
                </button>
              </li>,
              ...pastCourses
                .filter((c) => c.term === term)
                .map((c) => (
                  <PastCourseRow key={c.id} course={c} superseded={superseded.has(c.id)} />
                )),
            ])}
          </ul>
        )}
        {hasHistory && (
          <div
            className={cn(
              'mt-3 rounded-xl border p-3.5 transition-colors duration-200',
              recordComplete ? 'border-accent/50 bg-accent-soft' : 'border-border bg-surface',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                  recordComplete ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-subtle',
                )}
              >
                {recordComplete ? <ShieldCheck size={16} aria-hidden /> : <ListChecks size={16} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-fg">
                  {recordComplete
                    ? 'Your record is marked complete'
                    : 'Is this every course you have finished?'}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-subtle">
                  {recordComplete
                    ? 'Prerequisites are checked against it, so the course directory marks what you have met in green and what you have not in red.'
                    : 'Say yes and the course directory will mark prerequisites you have met in green and the ones you have not in red. Until then it shows the requirement without a verdict, because calling a course out of reach when a term is simply missing is worse than saying nothing.'}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {recordComplete ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRecordComplete(false)
                        void saveAcademicProfile({ recordComplete: false })
                      }}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:text-fg"
                    >
                      Something is missing
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRecordComplete(true)
                        void saveAcademicProfile({ recordComplete: true })
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                    >
                      <ShieldCheck size={13} aria-hidden />
                      Yes, that is everything
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
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
            value={shownGpa === null ? '\u2014' : shownGpa.toFixed(2)}
            note={
              shownGpa === null
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
        <GpaBreakdown pastCourses={pastCourses} assessments={assessments} />
        <CoopCard
          pastCourses={pastCourses}
          assessments={assessments}
          gpa={shownGpa}
          faculty={program?.faculty ?? user.school ?? null}
          program={program?.name ?? user.program ?? null}
        />
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
          program={program}
        />
      </Step>

      {exporting && snapshot && (
        <RecordSheet snapshot={snapshot} own onClose={() => setExporting(false)} />
      )}

      {pasting && <PasteTranscriptModal onClose={() => setPasting(false)} />}

      {(importing || importTerm !== null) && (
        <ImportSemesterModal
          initialTerm={importTerm ?? undefined}
          onClose={() => {
            setImporting(false)
            setImportTerm(null)
          }}
        />
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
