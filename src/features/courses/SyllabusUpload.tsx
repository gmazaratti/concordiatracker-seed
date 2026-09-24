import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, Clock, FileText, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { getParseUsage, normalizeKind, parseSyllabusPdf, type ParsedSyllabus, type ParseUsage } from '@/lib/parse-syllabus'
import { KIND_LABEL } from '@/lib/assessment'
import { MascotLoading } from '@/components/Mascot'
import { ScanTips } from './ScanTips'
import { matchAll } from './duplicate-assessments'
import { syllabusTarget } from '@/lib/course-match'
import { normalizeTerm } from '@/lib/term'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import type { Assessment, AssessmentKind, Course } from '@/data/types'

type Phase = 'idle' | 'parsing' | 'review' | 'error'
const MAX_MB = 4

interface CourseFields {
  code: string
  title: string
  term: string
  section: string
  instructorName: string
  instructorEmail: string
  taName: string
  taEmail: string
  gradingScale: string
}
const EMPTY_COURSE: CourseFields = {
  code: '', title: '', term: '', section: '',
  instructorName: '', instructorEmail: '', taName: '', taEmail: '', gradingScale: '',
}

interface ReviewItem {
  id: string
  title: string
  kind: AssessmentKind
  /** ISO timestamp, or null while the syllabus gave no date (blocks commit). */
  due: string | null
  weight: number
  description: string
}

const KIND_OPTIONS = (Object.keys(KIND_LABEL) as AssessmentKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))

/** Date-only ("2026-10-03") → local end-of-day ISO; full timestamps pass through;
 * anything unparseable → null (so it's flagged for the user, never guessed). */
function normalizeDue(due: string | null): string | null {
  if (!due) return null
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due.trim())
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return new Date(Number(y), Number(m) - 1, Number(d), 23, 59).toISOString()
  }
  const t = new Date(due)
  return Number.isNaN(t.getTime()) ? null : t.toISOString()
}

function toReview(parsed: ParsedSyllabus): ReviewItem[] {
  return parsed.assessments.map((a, i) => ({
    id: `r${i}`,
    title: a.title || 'Untitled',
    kind: normalizeKind(a.kind),
    due: normalizeDue(a.due),
    weight: typeof a.weight === 'number' ? Math.max(0, Math.min(100, a.weight)) : 0,
    description: a.description ?? '',
  }))
}

/** Derived usage state. Module-level so reading the clock is allowed (not in render). */
function usageState(u: ParseUsage): {
  remaining: number
  blocked: boolean
  message: string | null
  /** The sentence above the drop zone. Sized to the plan, not to a number. */
  allowance: string
} {
  const remaining = Math.max(0, u.limit - u.used)
  // On a paid plan `limit` is Infinity, and arithmetic on it renders
  // "Infinity of Infinity uploads left this month" -- caught on screen.
  // There is no count to show someone who has no cap.
  const allowance = u.unlimited
    ? 'Unlimited uploads on your pass'
    : `${remaining} of ${u.limit} uploads left this month`
  if (!u.unlimited && u.used >= u.limit) {
    return { remaining, blocked: true, allowance, message: `You've used all ${u.limit} uploads this month.` }
  }
  if (u.cooldownUntil) {
    const ms = new Date(u.cooldownUntil).getTime() - Date.now()
    if (ms > 0) {
      const secs = Math.ceil(ms / 1000)
      return {
        remaining,
        blocked: true,
        allowance,
        // Pro's cooldown is five seconds; rounding that up to "1 min" is a
        // minute of someone staring at a disabled button for no reason.
        message:
          secs < 60
            ? `Just uploaded: try again in ${secs}s.`
            : `Just uploaded: try again in ${Math.ceil(secs / 60)} min.`,
      }
    }
  }
  return { remaining, blocked: false, allowance, message: null }
}

/** The real AI syllabus parser: drag-drop a PDF → Gemini extraction (server-side)
 * → review what was found → commit into a new course. Parsed dates are tagged
 * `unverified`; nothing is saved until you confirm. */
export function SyllabusUploadPage({
  intoCourseId,
  onDone,
  embedded = false,
}: {
  /**
   * Import into a course that already exists instead of making a new one.
   *
   * The same flow either way — a reposted syllabus and a first import are the
   * same parse. What changes is the ending: no course is created, the course's
   * own details are left alone (you already filled those in), and anything that
   * looks like an assessment you already have is flagged before it is added.
   */
  intoCourseId?: string
  /**
   * Called instead of navigating once the import lands, with what was made.
   *
   * Onboarding needs the code and the count to add a line to its own list of
   * courses added so far, so this reports rather than just signalling. It is
   * the whole reason onboarding can use the REAL parser now: before, its
   * upload step was a scripted animation that threw the file away and
   * imported a sample course.
   */
  onDone?: (created?: { courseId: string; code: string; count: number }) => void
  /** Drop the page chrome (back link, h1) — the host screen has its own. */
  embedded?: boolean
} = {}) {
  const navigate = useNavigate()
  const { createCourse, addAssessments, updateCourse, assessments: allAssessments, courses } =
    useAppData()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [course, setCourse] = useState<CourseFields>(EMPTY_COURSE)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [saving, setSaving] = useState(false)
  const [usage, setUsage] = useState<ParseUsage | null>(null)
  // The scanning card used to say "syllabus.pdf" whatever you dropped on it,
  // which reads as a mock-up rather than your file being read.
  const [fileName, setFileName] = useState('')
  const u = usage ? usageState(usage) : null

  useEffect(() => {
    void getParseUsage().then(setUsage)
  }, [])

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      setPhase('error')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is too large (max ${MAX_MB} MB).`)
      setPhase('error')
      return
    }
    setFileName(file.name)
    setPhase('parsing')
    setError('')
    try {
      const parsed = await parseSyllabusPdf(file)
      const c = parsed.course
      setCourse({
        code: c.code ?? '',
        title: c.title ?? '',
        term: c.term ?? '',
        section: c.section ?? '',
        instructorName: c.instructorName ?? '',
        instructorEmail: c.instructorEmail ?? '',
        taName: c.taName ?? '',
        taEmail: c.taEmail ?? '',
        gradingScale: c.gradingScale ?? '',
      })
      setItems(toReview(parsed))
      setPhase('review')
      void getParseUsage().then(setUsage) // a successful parse consumed one
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setPhase('error')
    }
  }

  const patch = (id: string, p: Partial<ReviewItem>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)))
  const remove = (id: string) => setItems((list) => list.filter((it) => it.id !== id))

  const undated = items.filter((i) => !i.due).length
  const total = items.reduce((s, i) => s + i.weight, 0)
  const canCommit = items.length > 0 && !saving

  /**
   * A course the student ALREADY HAS with this code — the outline goes into it.
   *
   * Uploading RELI 230's syllabus when RELI 230 is already in your courses used
   * to make a second RELI 230, so the class showed twice and its credits
   * counted twice. Now the same parse lands in the existing course, with the
   * same duplicate check a re-import gets. Re-evaluated as the code field is
   * edited, so fixing a misread code finds the right course.
   */
  const matched = intoCourseId ? undefined : syllabusTarget(courses, course.code, course.term)
  const targetId = intoCourseId ?? matched?.id

  /** What this course already has, for the duplicate check. Empty for a new one. */
  const existing = useMemo(
    () =>
      targetId
        ? allAssessments
            .filter((a) => a.courseId === targetId)
            .map((a) => ({ id: a.id, title: a.title, kind: a.kind, weight: a.weight, due: a.due }))
        : [],
    [allAssessments, targetId],
  )

  const duplicates = useMemo(
    () =>
      existing.length === 0
        ? []
        : matchAll(
            items.map((i) => ({ title: i.title, kind: i.kind, weight: i.weight, due: i.due })),
            existing,
          ),
    [items, existing],
  )
  const confidentDupes = duplicates.filter((d) => d?.confident).length

  async function commit() {
    if (!canCommit) return
    setSaving(true)

    // ── Into a course that already exists ──────────────────────────────────
    if (targetId) {
      const add: Assessment[] = items
        .filter((_, i) => !duplicates[i]?.confident)
        .map((it) => ({
          id: crypto.randomUUID(),
          courseId: targetId,
          title: it.title.trim() || 'Untitled',
          kind: it.kind,
          due: it.due as string,
          weight: it.weight,
          provenance: { status: 'unverified' },
          status: 'not-started',
          grade: null,
          notes: '',
          description: it.description.trim() || undefined,
        }))
      if (course.gradingScale.trim()) {
        updateCourse(targetId, { gradingScale: course.gradingScale.trim() })
      }
      // A course found by its code keeps what the student already typed and
      // gains only what was blank — the outline does not get to overwrite them.
      if (matched) {
        const fill: Partial<Course> = {}
        if (!matched.instructor?.name && course.instructorName.trim()) {
          fill.instructor = { name: course.instructorName.trim(), email: course.instructorEmail.trim() }
        }
        if (!matched.section && course.section.trim()) fill.section = course.section.trim()
        if (!matched.title && course.title.trim()) fill.title = course.title.trim()
        if (Object.keys(fill).length > 0) updateCourse(matched.id, fill)
      }
      if (add.length > 0) await addAssessments(add)
      setSaving(false)
      if (onDone) {
        onDone(intoCourseId ? undefined : { courseId: targetId, code: course.code.trim(), count: add.length })
        return
      }
      if (!intoCourseId) navigate(`/app/courses/${targetId}`)
      return
    }

    // The outline's own term, when it states one, so the new course is filed in
    // it — and so the duplicate check is asked about the right term.
    const parsedTerm = normalizeTerm(course.term)
    const id = await createCourse({ source: 'syllabus',
      code: course.code.trim(),
      title: course.title.trim(),
      section: course.section.trim(),
      ...(parsedTerm ? { term: parsedTerm } : {}),
    })
    if (!id) {
      setSaving(false)
      setError('Couldn’t create the course: try again.')
      setPhase('error')
      return
    }
    const ta =
      course.taName.trim() || course.taEmail.trim()
        ? { name: course.taName.trim(), email: course.taEmail.trim() }
        : null
    updateCourse(id, {
      ...(course.term.trim() ? { term: course.term.trim() } : {}),
      instructor: { name: course.instructorName.trim(), email: course.instructorEmail.trim() },
      ta,
    })
    // Grading scale needs a (possibly unmigrated) column — write it on its own so
    // a missing column can't take the rest of the logistics down with it.
    if (course.gradingScale.trim()) updateCourse(id, { gradingScale: course.gradingScale.trim() })

    const assessments: Assessment[] = items.map((it) => ({
      id: crypto.randomUUID(),
      courseId: id,
      title: it.title.trim() || 'Untitled',
      kind: it.kind,
      due: it.due as string,
      weight: it.weight,
      provenance: { status: 'unverified' },
      status: 'not-started',
      grade: null,
      notes: '',
      description: it.description.trim() || undefined,
    }))
    await addAssessments(assessments)
    setSaving(false)
    // Embedded callers stay where they are: onboarding is a sequence of steps
    // and yanking someone out of it onto a course page abandons the rest.
    if (onDone) {
      onDone({ courseId: id, code: course.code.trim(), count: assessments.length })
      return
    }
    navigate(`/app/courses/${id}`)
  }

  return (
    <div className={embedded ? 'w-full' : 'mx-auto w-full max-w-2xl px-5 py-5 sm:px-6'}>
      {!embedded && (
        <button
          type="button"
          onClick={() => navigate('/app/courses')}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={16} aria-hidden /> Courses
        </button>
      )}

      {phase !== 'review' && !embedded && (
        <>
          <h1 className="flex items-center gap-2 font-display text-[22px] font-semibold text-fg">
            <Sparkles size={18} className="text-accent" aria-hidden /> Upload a syllabus
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Drop your syllabus PDF: we’ll pull out the course details and every assessment for you to review.
          </p>
        </>
      )}

      {phase === 'idle' && (
        <>
          <DropZone onFile={handleFile} disabled={!!u?.blocked} />
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12px] text-subtle">
            <Clock size={13} aria-hidden />
            {u?.blocked ? (
              <span className="font-medium text-warning">{u.message}</span>
            ) : (
              <span>
                {u ? u.allowance : 'Up to 5 uploads per month on the free plan'}
                {' · '}parsing can take up to ~15 seconds
              </span>
            )}
          </p>
        </>
      )}
      {phase === 'parsing' && <Scanning fileName={fileName} />}
      {phase === 'error' && (
        <div className="mt-6 rounded-2xl border border-danger/40 bg-danger/5 p-6 text-center">
          <AlertTriangle size={24} className="mx-auto text-danger" aria-hidden />
          <p className="mt-2 text-[14px] font-medium text-fg">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError('')
              setPhase('idle')
            }}
            className="mt-3 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        </div>
      )}

      {phase === 'review' && (
        <div>
          <CourseEdit course={course} setCourse={setCourse} />

          {matched && (
            <p className="mt-3 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-[12.5px] leading-relaxed text-fg">
              You already have <span className="font-semibold">{matched.code}</span>
              {matched.term ? ` (${matched.term})` : ''}, so these go into that course instead of a
              second copy. Anything that matches an assessment already there is skipped.
            </p>
          )}

          {items.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface/50 px-5 py-8 text-center text-[13px] text-subtle">
              No graded assessments were found in that document.
            </p>
          ) : (
            <>
              <div className="mt-4 mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                  {items.length} assessment{items.length === 1 ? '' : 's'}{' '}
                  <span className="font-normal normal-case">· unverified until you confirm</span>
                </h2>
                <span className={cn('text-[12px] font-medium', Math.round(total) === 100 ? 'text-success' : 'text-subtle')}>
                  {Math.round(total)}%
                </span>
              </div>

              {undated > 0 && (
                <p className="mb-2 flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-muted">
                  <Clock size={14} className="mt-px shrink-0 text-subtle" aria-hidden />
                  <span>
                    {undated} {undated === 1 ? 'item has' : 'items have'} no date &mdash; usually a
                    final the registrar hasn&rsquo;t scheduled. That&rsquo;s fine:{' '}
                    {undated === 1 ? 'it' : 'they'} will be added as{' '}
                    <span className="font-medium text-fg">date not set</span> and show up on Today
                    under &ldquo;No date yet&rdquo;. Set{' '}
                    {undated === 1 ? 'it' : 'them'} whenever the date is published.
                  </span>
                </p>
              )}

              {/* Said before the button, not after the damage. Re-importing a
                  corrected syllabus is normal; silently doubling every item is
                  how a grade breakdown ends up adding to 200%. */}
              {confidentDupes > 0 && (
                <p className="mb-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] leading-relaxed text-muted">
                  <span className="font-medium text-fg">
                    {confidentDupes} {confidentDupes === 1 ? 'item is' : 'items are'} already on this
                    course
                  </span>{' '}
                  and will be skipped, so nothing is duplicated. Remove the ones you want replaced
                  from the course first, or leave them — the rest still import.
                </p>
              )}

              {/* A 20-item outline used to run the page metres long, pushing the
                  Add button off-screen and making the weight total — the number
                  you are checking — scroll away. The list gets its own scroll
                  region above ~8 items; under that it sits in flow, because a
                  scrollbar around four rows is noise. `overscroll-contain` stops
                  the page lurching when you reach the end of it. */}
              <ul
                className={cn(
                  'space-y-1.5',
                  items.length > 8 &&
                    'max-h-[min(58vh,520px)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface/30 p-2',
                )}
              >
                {items.map((it, i) => (
                  <li key={it.id}>
                    <ReviewRow item={it} onPatch={(p) => patch(it.id, p)} onRemove={() => remove(it.id)} />
                    {duplicates[i] && (
                      <p
                        className={cn(
                          'mt-0.5 pl-1 text-[11px]',
                          duplicates[i]!.confident ? 'text-warning' : 'text-subtle',
                        )}
                      >
                        {duplicates[i]!.confident ? 'Skipping — ' : 'Possibly '}
                        matches &ldquo;{duplicates[i]!.title}&rdquo; you already have (
                        {duplicates[i]!.reason}).
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-border bg-canvas/95 py-3 backdrop-blur">
            <button
              type="button"
              disabled={!canCommit}
              onClick={() => void commit()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" aria-hidden />}
              {intoCourseId
                ? `Add ${items.length - confidentDupes} to this course`
                : matched
                  ? `Add ${items.length - confidentDupes} to your ${matched.code}`
                  : `Add ${items.length} to a new course`}
            </button>
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled) return
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
      className={cn(
        'mt-6 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
        disabled
          ? 'cursor-not-allowed border-border bg-surface/40 opacity-60'
          : over
            ? 'border-accent bg-accent-soft'
            : 'border-border-strong bg-surface/40 hover:border-accent/60',
      )}
    >
      <UploadCloud size={32} className="text-accent" aria-hidden />
      <span className="text-[15px] font-medium text-fg">Drop your syllabus PDF here</span>
      <span className="text-[12px] text-subtle">or click to browse · PDF up to {MAX_MB} MB</span>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </button>
  )
}

function Scanning({ fileName }: { fileName: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <MascotLoading
        mood="working"
        title="Reading your syllabus…"
        hint="Pulling out every date, weight and assessment. Usually 5–15 seconds."
      />
      <div className="relative mt-3 overflow-hidden rounded-lg border border-border bg-canvas/50 p-4 font-mono text-[11px] leading-relaxed text-subtle">
        <div className="flex items-center gap-1.5 text-muted">
          <FileText size={13} className="shrink-0" aria-hidden />
          <span className="truncate" title={fileName}>
            {fileName || 'your syllabus'}
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          {[88, 72, 94, 60, 80, 68].map((w, i) => (
            <div key={i} className="h-2 rounded bg-border" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div
          className="ct-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-accent/0 via-accent/25 to-accent/0"
          aria-hidden
        />
      </div>
      {/* The wait is long enough to be noticed, so it gets something to read
          rather than a second sentence restating the first one. */}
      <ScanTips className="mt-3 border-t border-border pt-3" />
    </div>
  )
}

const FIELD = 'w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle outline-none focus:border-border-strong'

/** Compact course identity (code · section · term · title) with the contact +
 * grading details tucked into a collapsed disclosure, so the assessments below
 * stay visible without scrolling. A summary line shows what was extracted. */
function CourseEdit({ course, setCourse }: { course: CourseFields; setCourse: (c: CourseFields) => void }) {
  const [open, setOpen] = useState(false)
  const set = (p: Partial<CourseFields>) => setCourse({ ...course, ...p })

  const found = [
    course.instructorName.trim() && course.instructorName.trim(),
    course.taName.trim() && `TA: ${course.taName.trim()}`,
    course.gradingScale.trim() && 'grading scale',
  ].filter(Boolean)
  const summary = found.length ? found.join(' · ') : 'Add instructor, TA & grading'

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="grid grid-cols-[1.2fr_0.8fr_1fr] gap-2">
        <input className={FIELD} placeholder="Code" value={course.code} onChange={(e) => set({ code: e.target.value })} />
        <input className={FIELD} placeholder="Section" value={course.section} onChange={(e) => set({ section: e.target.value })} />
        <input className={FIELD} placeholder="Term" value={course.term} onChange={(e) => set({ term: e.target.value })} />
      </div>
      <input className={cn(FIELD, 'mt-2')} placeholder="Course title" value={course.title} onChange={(e) => set({ title: e.target.value })} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 flex w-full items-center gap-1.5 text-left text-[12px] text-subtle transition-colors hover:text-fg"
      >
        <ChevronDown size={14} className={cn('shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        <span className="truncate">{summary}</span>
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2.5">
          <input className={FIELD} placeholder="Instructor" value={course.instructorName} onChange={(e) => set({ instructorName: e.target.value })} />
          <input className={FIELD} placeholder="Instructor email" value={course.instructorEmail} onChange={(e) => set({ instructorEmail: e.target.value })} />
          <input className={FIELD} placeholder="TA (optional)" value={course.taName} onChange={(e) => set({ taName: e.target.value })} />
          <input className={FIELD} placeholder="TA email (optional)" value={course.taEmail} onChange={(e) => set({ taEmail: e.target.value })} />
          <input className={cn(FIELD, 'col-span-2')} placeholder="Grading scale (e.g. A: 90–100, B+: 85–89…)" value={course.gradingScale} onChange={(e) => set({ gradingScale: e.target.value })} />
        </div>
      )}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold tracking-wide text-subtle uppercase">{label}</span>
      {children}
    </span>
  )
}

function ReviewRow({ item, onPatch, onRemove }: { item: ReviewItem; onPatch: (p: Partial<ReviewItem>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const noDate = !item.due
  return (
    <li className={cn('rounded-lg border bg-surface px-2.5 py-2', noDate ? 'border-warning/50' : 'border-border')}>
      {/* Type + Title + row actions */}
      <div className="flex items-center gap-2">
        <Select
          ariaLabel="Type"
          size="sm"
          tone="control"
          value={item.kind}
          onChange={(v) => onPatch({ kind: v as AssessmentKind })}
          options={KIND_OPTIONS}
          className="w-[104px] shrink-0"
        />
        <input
          value={item.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          aria-label="Title"
          placeholder="Title"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-medium text-fg outline-none hover:border-border focus:border-border-strong"
        />
        {item.description && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle details"
            aria-expanded={open}
            className={cn('shrink-0 transition-colors', open ? 'text-fg' : 'text-subtle hover:text-fg')}
          >
            <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        )}
        <button type="button" onClick={onRemove} aria-label="Remove" className="shrink-0 text-subtle transition-colors hover:text-danger">
          <Trash2 size={14} aria-hidden />
        </button>
      </div>

      {/* Labeled Due + Weight: the at-a-glance indicators */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-0.5">
        {/* No date is a legitimate answer, not a problem to be cleared. This
            used to be a warning-coloured "Set a date" button that INVENTED one
            a week out — which is how a final the registrar has not scheduled
            ends up with a confident wrong deadline the student plans around.
            The picker now shows "Date not set" and can be put back to it. */}
        <Labeled label="Due">
          <DateTimePicker
            ariaLabel="Due date"
            value={item.due}
            clearable
            onChange={(iso) => onPatch({ due: iso })}
          />
        </Labeled>

        <Labeled label="Weight">
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-canvas px-1.5 py-0.5">
            <input
              type="number"
              min={0}
              max={100}
              value={item.weight}
              onChange={(e) => onPatch({ weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              aria-label="Weight percent"
              className="w-8 bg-transparent text-right text-[12px] text-fg outline-none"
            />
            <span className="text-[11px] text-subtle">%</span>
          </div>
        </Labeled>
      </div>

      {open && item.description && <p className="mt-2 text-[12px] leading-relaxed text-subtle">{item.description}</p>}
    </li>
  )
}
