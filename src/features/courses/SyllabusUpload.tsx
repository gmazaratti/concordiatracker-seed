import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, FileText, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { normalizeKind, parseSyllabusPdf, type ParsedSyllabus } from '@/lib/parse-syllabus'
import { KIND_LABEL } from '@/lib/assessment'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import type { Assessment, AssessmentKind } from '@/data/types'

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

/** The real AI syllabus parser: drag-drop a PDF → Gemini extraction (server-side)
 * → review what was found → commit into a new course. Parsed dates are tagged
 * `unverified`; nothing is saved until you confirm. */
export function SyllabusUploadPage() {
  const navigate = useNavigate()
  const { createCourse, addAssessments, updateCourse } = useAppData()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [course, setCourse] = useState<CourseFields>(EMPTY_COURSE)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [saving, setSaving] = useState(false)

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
  const canCommit = items.length > 0 && undated === 0 && !saving

  async function commit() {
    if (!canCommit) return
    setSaving(true)
    const id = await createCourse({
      code: course.code.trim(),
      title: course.title.trim(),
      section: course.section.trim(),
    })
    if (!id) {
      setSaving(false)
      setError('Couldn’t create the course — try again.')
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
    navigate(`/app/courses/${id}`)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/app/courses')}
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden /> Courses
      </button>

      {phase !== 'review' && (
        <>
          <h1 className="flex items-center gap-2 font-display text-[22px] font-semibold text-fg">
            <Sparkles size={18} className="text-accent" aria-hidden /> Upload a syllabus
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Drop your syllabus PDF — we’ll pull out the course details and every assessment for you to review.
          </p>
        </>
      )}

      {phase === 'idle' && <DropZone onFile={handleFile} />}
      {phase === 'parsing' && <Scanning />}
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
                <p className="mb-2 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-[12px] font-medium text-warning">
                  <AlertTriangle size={14} aria-hidden />
                  {undated} {undated === 1 ? 'item has' : 'items have'} no date — set or remove{' '}
                  {undated === 1 ? 'it' : 'them'} to add.
                </p>
              )}

              <ul className="space-y-1.5">
                {items.map((it) => (
                  <ReviewRow key={it.id} item={it} onPatch={(p) => patch(it.id, p)} onRemove={() => remove(it.id)} />
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
              Add {items.length} to a new course
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

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
      className={cn(
        'mt-6 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
        over ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface/40 hover:border-accent/60',
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

function Scanning() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
        <Loader2 size={15} className="animate-spin text-accent" aria-hidden />
        Reading your syllabus…
      </div>
      <div className="relative mt-3 overflow-hidden rounded-lg border border-border bg-canvas/50 p-4 font-mono text-[11px] leading-relaxed text-subtle">
        <div className="flex items-center gap-1.5 text-muted">
          <FileText size={13} aria-hidden /> syllabus.pdf
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
      <p className="mt-2.5 text-[12px] text-subtle">Extracting course details, assessments, weights, and deadlines…</p>
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

      {/* Labeled Due + Weight — the at-a-glance indicators */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-0.5">
        <Labeled label="Due">
          {noDate ? (
            <button
              type="button"
              onClick={() => onPatch({ due: new Date(Date.now() + 7 * 86_400_000).toISOString() })}
              className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-[12px] font-medium text-warning"
            >
              <AlertTriangle size={12} aria-hidden /> Set a date
            </button>
          ) : (
            <DateTimePicker ariaLabel="Due date" value={item.due as string} onChange={(iso) => onPatch({ due: iso })} />
          )}
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
