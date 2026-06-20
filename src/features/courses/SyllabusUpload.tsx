import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, FileText, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { normalizeKind, parseSyllabusPdf, type ParsedSyllabus } from '@/lib/parse-syllabus'
import { KIND_LABEL } from '@/lib/assessment'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Select } from '@/components/ui/Select'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { cn } from '@/lib/cn'
import type { Assessment, AssessmentKind } from '@/data/types'

type Phase = 'idle' | 'parsing' | 'review' | 'error'
const MAX_MB = 4

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
  const [course, setCourse] = useState({ code: '', title: '', term: '', instructor: '' })
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
      setCourse({
        code: parsed.course.code ?? '',
        title: parsed.course.title ?? '',
        term: parsed.course.term ?? '',
        instructor: parsed.course.instructor ?? '',
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
    const id = await createCourse({ code: course.code.trim(), title: course.title.trim() })
    if (!id) {
      setSaving(false)
      setError('Couldn’t create the course — try again.')
      setPhase('error')
      return
    }
    if (course.instructor.trim() || course.term.trim()) {
      updateCourse(id, {
        ...(course.instructor.trim() ? { instructor: { name: course.instructor.trim(), email: '' } } : {}),
        ...(course.term.trim() ? { term: course.term.trim() } : {}),
      })
    }
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
    <div className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/app/courses')}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden /> Courses
      </button>

      <h1 className="flex items-center gap-2 font-display text-[22px] font-semibold text-fg">
        <Sparkles size={18} className="text-accent" aria-hidden /> Upload a syllabus
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Drop your syllabus PDF and we’ll pull out every assessment, weight, and deadline for you to review.
      </p>

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
        <div className="mt-5">
          <CourseHeaderEdit course={course} setCourse={setCourse} />

          {items.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-border-strong bg-surface/50 px-5 py-8 text-center text-[13px] text-subtle">
              No graded assessments were found in that document.
            </p>
          ) : (
            <>
              <div className="mt-5 mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                  {items.length} assessment{items.length === 1 ? '' : 's'} found
                </h2>
                <span className={cn('text-[12px] font-medium', Math.round(total) === 100 ? 'text-success' : 'text-subtle')}>
                  Weights total {Math.round(total)}%
                </span>
              </div>

              {undated > 0 && (
                <p className="mb-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] font-medium text-warning">
                  <AlertTriangle size={14} aria-hidden />
                  {undated} {undated === 1 ? 'assessment has' : 'assessments have'} no date — set or remove{' '}
                  {undated === 1 ? 'it' : 'them'} before adding.
                </p>
              )}

              <ul className="space-y-2.5">
                {items.map((it) => (
                  <ReviewRow key={it.id} item={it} onPatch={(p) => patch(it.id, p)} onRemove={() => remove(it.id)} />
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 flex items-center gap-3">
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
      <p className="mt-2.5 text-[12px] text-subtle">Extracting assessments, weights, and deadlines…</p>
    </div>
  )
}

function CourseHeaderEdit({
  course,
  setCourse,
}: {
  course: { code: string; title: string; term: string; instructor: string }
  setCourse: (c: { code: string; title: string; term: string; instructor: string }) => void
}) {
  const field =
    'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle outline-none focus:border-border-strong'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">Course</p>
      <div className="grid grid-cols-2 gap-2.5">
        <input className={field} placeholder="Code (e.g. COMP 248)" value={course.code} onChange={(e) => setCourse({ ...course, code: e.target.value })} />
        <input className={field} placeholder="Term (e.g. Fall 2026)" value={course.term} onChange={(e) => setCourse({ ...course, term: e.target.value })} />
        <input className={cn(field, 'col-span-2')} placeholder="Title" value={course.title} onChange={(e) => setCourse({ ...course, title: e.target.value })} />
        <input className={cn(field, 'col-span-2')} placeholder="Instructor" value={course.instructor} onChange={(e) => setCourse({ ...course, instructor: e.target.value })} />
      </div>
    </div>
  )
}

function ReviewRow({ item, onPatch, onRemove }: { item: ReviewItem; onPatch: (p: Partial<ReviewItem>) => void; onRemove: () => void }) {
  const noDate = !item.due
  return (
    <li className={cn('rounded-xl border bg-surface p-3', noDate ? 'border-warning/50' : 'border-border')}>
      <div className="flex items-start gap-2">
        <input
          value={item.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          aria-label="Assessment title"
          className="min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[13px] font-medium text-fg outline-none focus:border-border-strong"
        />
        <ProvenanceBadge provenance={{ status: 'unverified' }} className="mt-1.5 shrink-0" />
        <button type="button" onClick={onRemove} aria-label="Remove" className="mt-1 shrink-0 text-subtle transition-colors hover:text-danger">
          <Trash2 size={15} aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select
          ariaLabel="Kind"
          size="sm"
          tone="control"
          value={item.kind}
          onChange={(v) => onPatch({ kind: v as AssessmentKind })}
          options={KIND_OPTIONS}
          className="w-36"
        />
        <div className="flex items-center gap-1 rounded-lg border border-border bg-canvas px-2 py-1">
          <input
            type="number"
            min={0}
            max={100}
            value={item.weight}
            onChange={(e) => onPatch({ weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            aria-label="Weight"
            className="w-12 bg-transparent text-right text-[13px] text-fg outline-none"
          />
          <span className="text-[12px] text-subtle">%</span>
        </div>

        {noDate ? (
          <button
            type="button"
            onClick={() => onPatch({ due: new Date(Date.now() + 7 * 86_400_000).toISOString() })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-[12px] font-medium text-warning"
          >
            <AlertTriangle size={13} aria-hidden /> Set a date
          </button>
        ) : (
          <DateTimePicker ariaLabel="Due date" value={item.due as string} onChange={(iso) => onPatch({ due: iso })} />
        )}
      </div>

      {item.description && <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-subtle">{item.description}</p>}
    </li>
  )
}
