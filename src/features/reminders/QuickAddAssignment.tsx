import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ModalShell } from '@/command/ModalShell'
import { useAppData } from '@/app/providers/app-data'
import { Select } from '@/components/ui/Select'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import type { Assessment } from '@/data/types'
import { haptic } from '@/lib/haptics'

/**
 * The sheet Siri's "Add an assignment in ConcordiaTracker" opens
 * (`/app?new-assignment=<title>&due=<iso>`, from ios/App/App/AppIntents.swift).
 *
 * Siri collects the words; the course and the weight are picked here, because
 * an assignment belongs to a course and choosing one out loud from a list is
 * worse than tapping it. Nothing is created until Save.
 */
export function QuickAddAssignment() {
  const [params, setParams] = useSearchParams()
  const initialTitle = params.get('new-assignment')
  if (initialTitle === null) return null
  const close = () => {
    const next = new URLSearchParams(params)
    next.delete('new-assignment')
    next.delete('due')
    setParams(next, { replace: true })
  }
  return <Sheet key={initialTitle} initialTitle={initialTitle} initialDue={params.get('due')} onClose={close} />
}

function Sheet({ initialTitle, initialDue, onClose }: { initialTitle: string; initialDue: string | null; onClose: () => void }) {
  const { courses, addAssessments } = useAppData()
  const [title, setTitle] = useState(initialTitle)
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [due, setDue] = useState<string | null>(initialDue && !Number.isNaN(Date.parse(initialDue)) ? initialDue : null)
  const [weightText, setWeightText] = useState('')
  const [saving, setSaving] = useState(false)
  const weight = Number(weightText || '0')
  const canSave = title.trim() !== '' && courseId !== '' && weight >= 0 && weight <= 100 && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    const item: Assessment = {
      id: crypto.randomUUID(),
      courseId,
      title: title.trim(),
      kind: 'assignment',
      due,
      weight,
      // Typed in by the student, so nobody has confirmed it.
      provenance: { status: 'unverified' },
      status: 'not-started',
      grade: null,
      notes: '',
    }
    await addAssessments([item])
    haptic('success')
    onClose()
  }

  return (
    <ModalShell label="Add an assignment" onClose={onClose}>
      <div className="p-5">
        <h2 className="font-display text-[18px] font-semibold text-fg">Add an assignment</h2>
        {courses.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">Add a course first; an assignment belongs to one.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-subtle">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-[15px] text-fg outline-none focus:border-border-strong"
              />
            </label>
            <div>
              <span className="mb-1 block text-[12px] font-medium text-subtle">Course</span>
              <Select
                ariaLabel="Course"
                value={courseId}
                onChange={setCourseId}
                options={courses.map((c) => ({ value: c.id, label: c.code ? `${c.code} · ${c.title}` : c.title || 'Untitled' }))}
              />
            </div>
            <div>
              <span className="mb-1 block text-[12px] font-medium text-subtle">Due</span>
              <DateTimePicker value={due} onChange={setDue} clearable ariaLabel="Due date and time" />
            </div>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-subtle">Weight (% of the course)</span>
              <input
                value={weightText}
                onChange={(e) => setWeightText(e.target.value)}
                inputMode="decimal"
                placeholder="10"
                className="w-28 rounded-lg border border-border bg-canvas px-3 py-2.5 text-[15px] text-fg outline-none focus:border-border-strong"
              />
            </label>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void save()}
              className="min-h-11 w-full rounded-lg bg-accent text-[14px] font-medium text-accent-contrast disabled:opacity-50"
            >
              Add assignment
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
