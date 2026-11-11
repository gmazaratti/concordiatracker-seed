import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ClipboardPaste, ListChecks, Lock, Plus, Share2, ShieldCheck } from 'lucide-react'
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
import { RecordHero } from './record/RecordHero'
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
 * A banner with the number people open this page for, then four titled parts:
 * about you, what you have finished (one card per term), where that leaves you,
 * and what it unlocks. A part with nothing to work from says what it is waiting
 * for instead of showing an empty result.
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

  // The page's actions live in the banner: the way in (paste, import) and the
  // way out (export). Export is hidden until there is something to export.
  const heroButton =
    'inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors duration-150'
  const actions = (
    <>
      <button type="button" onClick={() => setPasting(true)} title="Paste your transcript and confirm what was read" className={cn(heroButton, 'bg-white text-black hover:bg-white/90')}>
        <ClipboardPaste size={15} aria-hidden />
        Paste my courses
      </button>
      <button type="button" onClick={() => setImporting(true)} title="Add a term one course at a time" className={cn(heroButton, 'bg-white/15 text-white backdrop-blur-md hover:bg-white/25')}>
        <CalendarPlus size={15} aria-hidden />
        Import a semester
      </button>
      {hasHistory && (
        <button type="button" onClick={() => setExporting(true)} disabled={!snapshot} className={cn(heroButton, 'bg-white/15 text-white backdrop-blur-md hover:bg-white/25 disabled:opacity-60')}>
          <Share2 size={15} aria-hidden />
          Export or share
        </button>
      )}
    </>
  )
  const terms = sortTermsDesc([...new Set(pastCourses.map((c) => c.term))])

  return (
    <div className="space-y-10 pb-4">
      <RecordHero
        gpa={shownGpa}
        credits={summary.credits}
        gradedCredits={summary.gradedCredits}
        courses={summary.courseCount}
        subjects={summary.subjects}
        complete={recordComplete}
        actions={actions}
      />

      {/* ── About you ────────────────────────────────────────────────── */}
      <Section
        title="About you"
        sub="Your year and major decide which subjects are scanned for what you can take next."
        badge={knowsWhere ? null : 'Start here'}
      >
        <div className="ct-res-in grid gap-4 rounded-3xl border border-border bg-surface p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-[1fr_1fr_1.4fr]">
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
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </Field>
          <div className="sm:col-span-2 xl:col-span-1">
            <Field label="Major">
              <ProgramPicker
                size="sm"
                value={user.program ? { id: 'existing', name: user.program } : null}
                onChange={(sel) => setProgram(sel)}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── Finished courses ─────────────────────────────────────────── */}
      <Section
        title="What you have finished"
        sub="Grades are optional. Without one a course still counts for credits and prerequisites, it just does not move your GPA."
      >
        <div className="ct-res-in rounded-3xl border border-border bg-surface p-5 sm:p-6">
          <p className="mb-3 text-[14px] font-semibold text-fg">Add one class</p>
          <PastCourseEntry />
        </div>

        {hasHistory && (
          // One card per term, newest first, two across on a wide screen: a
          // single long list made every term look like part of the one before.
          <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
            {terms.map((term, i) => {
              const rows = pastCourses.filter((c) => c.term === term)
              const credits = rows.reduce((n, c) => n + (c.credits ?? 0), 0)
              return (
                <div
                  key={term}
                  className="ct-res-in overflow-hidden rounded-3xl border border-border bg-surface"
                  style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-surface-2/50 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-display text-[18px] leading-tight font-semibold text-fg">{term}</p>
                      <p className="text-[12.5px] text-muted">
                        {rows.length} {rows.length === 1 ? 'course' : 'courses'} · {credits} credits
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImportTerm(term)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
                    >
                      <Plus size={13} aria-hidden /> Add a class
                    </button>
                  </div>
                  <ul className="divide-y divide-border/70">
                    {rows.map((c) => (
                      <PastCourseRow key={c.id} course={c} superseded={superseded.has(c.id)} />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        {hasHistory && (
          <div
            className={cn(
              'ct-res-in mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-3xl border p-5 transition-colors duration-200 sm:p-6',
              recordComplete ? 'border-accent/50 bg-accent-soft' : 'border-warning/40 bg-warning/[0.08]',
            )}
          >
            <span
              className={cn(
                'grid size-12 shrink-0 place-items-center rounded-full',
                recordComplete ? 'bg-accent text-accent-contrast' : 'bg-warning text-black',
              )}
            >
              {recordComplete ? <ShieldCheck size={22} aria-hidden /> : <ListChecks size={22} aria-hidden />}
            </span>
            <div className="min-w-0 flex-1 basis-64">
              <p className="font-display text-[18px] leading-snug font-semibold text-fg">
                {recordComplete ? 'Your record is marked complete' : 'Is this every course you have finished?'}
              </p>
              <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">
                {recordComplete
                  ? 'Prerequisites are checked against it, so the course directory marks what you have met in green and what you have not in red.'
                  : 'Say yes and the course directory will mark prerequisites you have met in green and the ones you have not in red. Until then it shows the requirement without a verdict, because calling a course out of reach when a term is simply missing is worse than saying nothing.'}
              </p>
            </div>
            {recordComplete ? (
              <button
                type="button"
                onClick={() => {
                  setRecordComplete(false)
                  void saveAcademicProfile({ recordComplete: false })
                }}
                className="rounded-full border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-border-strong"
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
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
              >
                <ShieldCheck size={15} aria-hidden />
                Yes, that is everything
              </button>
            )}
          </div>
        )}
      </Section>

      {/* ── Where that leaves you ────────────────────────────────────── */}
      <Section title="Where that leaves you" sub="How your GPA is built, and where you stand for co-op.">
        {hasHistory ? (
          <div className="space-y-4">
            <GpaBreakdown pastCourses={pastCourses} assessments={assessments} />
            <CoopCard
              pastCourses={pastCourses}
              assessments={assessments}
              gpa={shownGpa}
              faculty={program?.faculty ?? user.school ?? null}
              program={program?.name ?? user.program ?? null}
            />
          </div>
        ) : (
          <Waiting>Add a finished course above and your GPA and standing appear here.</Waiting>
        )}
      </Section>

      {/* ── What that unlocks ────────────────────────────────────────── */}
      <Section title="What that unlocks" sub="Courses whose prerequisites you have now met.">
        {hasHistory ? (
          <Unlocks completed={summary.completedCodes} subjects={summary.subjects} credits={summary.credits} program={program} />
        ) : (
          <Waiting>
            Once we know what you have finished, this reads the prerequisites for your subjects and tells you what you
            can take.
          </Waiting>
        )}
      </Section>

      {exporting && snapshot && <RecordSheet snapshot={snapshot} own onClose={() => setExporting(false)} />}

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

/** A titled part of the page. The badge marks the one to do first. */
function Section({
  title,
  sub,
  badge,
  children,
}: {
  title: string
  sub?: string
  badge?: string | null
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="flex flex-wrap items-center gap-2.5 font-display text-[22px] font-semibold tracking-tight text-fg">
        {title}
        {badge && <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11.5px] font-semibold text-accent-contrast">{badge}</span>}
      </h3>
      {sub && <p className="mt-0.5 max-w-3xl text-[13px] text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** What a section says while it has nothing to work from. */
function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 rounded-3xl border border-dashed border-border-strong px-5 py-6 text-[14px] leading-relaxed text-muted">
      <Lock size={17} className="shrink-0 text-subtle" aria-hidden />
      {children}
    </p>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}
