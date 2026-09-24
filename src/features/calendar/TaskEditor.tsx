import { useState } from 'react'
import { Plus, Repeat, Trash2, X } from 'lucide-react'
import type { CalendarTask, TaskStep } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Segmented } from '@/features/settings/controls'
import { cn } from '@/lib/cn'
import {
  REPEAT_LABEL,
  describeRepeat,
  newRepeatGroup,
  repeatOccurrences,
  type RepeatRule,
} from './task-repeat'

const RULES: RepeatRule[] = ['none', 'daily', 'weekdays', 'weekly']

/**
 * The one form for a personal calendar item — used for both adding and
 * editing, so the two can never offer different fields.
 *
 * `todos.note` has existed since Phase 4 and `ItemRow` has always rendered it;
 * until now there was no control anywhere in the app that could put anything
 * in it. Half of this screen is not a new column, it is a column finally
 * reachable.
 *
 * THE CHECKLIST IS THE POINT, not decoration. "Study for COMM 305" on a
 * Tuesday tells you nothing you did not already know; "re-do problem set 4,
 * re-read chapter 9, past exam under time" is the thing you actually sit down
 * and work through, and each line ticks on its own.
 */
export function TaskEditor({
  task,
  defaultDue,
  onDone,
}: {
  /** Editing an existing item; omit to add a new one. */
  task?: CalendarTask
  /** The day the editor was opened on (add mode). */
  defaultDue?: string
  onDone: () => void
}) {
  const { addTasks, updateTask, removeTask, removeTaskSeries } = useAppData()
  const editing = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [due, setDue] = useState(task?.due ?? defaultDue ?? new Date().toISOString())
  const [note, setNote] = useState(task?.note ?? '')
  const [steps, setSteps] = useState<TaskStep[]>(task?.steps ?? [])
  const [rule, setRule] = useState<RepeatRule>('none')
  const [until, setUntil] = useState(() => {
    const d = new Date(task?.due ?? defaultDue ?? Date.now())
    d.setDate(d.getDate() + 13)
    return d.toISOString()
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const clean = steps.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text !== '')
  const summary = describeRepeat(due, rule, until)

  async function save() {
    const name = title.trim()
    if (!name || saving) return
    setSaving(true)
    if (editing) {
      updateTask(task.id, { title: name, due, note: note.trim() || undefined, steps: clean })
    } else {
      const days = repeatOccurrences(due, rule, until)
      const group = rule === 'none' ? undefined : newRepeatGroup(days.length)
      await addTasks(
        days.map((d) => ({
          title: name,
          due: d,
          note: note.trim() || undefined,
          steps: clean,
          repeatGroup: group,
        })),
      )
    }
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={title}
        autoFocus
        placeholder="Study for the COMM 305 midterm"
        aria-label="What is it"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) void save()
        }}
        className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus-visible:outline-none"
      />

      <Field label="When">
        <DateTimePicker value={due} onChange={(v) => v && setDue(v)} ariaLabel="When" />
      </Field>

      <Field label="Notes">
        <textarea
          value={note}
          rows={2}
          placeholder="Chapters 4–7. Formula sheet allowed."
          aria-label="Notes"
          onChange={(e) => setNote(e.target.value)}
          className="w-full resize-y rounded-lg border border-border-strong bg-surface px-3 py-2 text-[13px] leading-relaxed text-fg placeholder:text-subtle focus-visible:outline-none"
        />
      </Field>

      <Field label="Checklist">
        <StepList steps={steps} onChange={setSteps} />
      </Field>

      {/* Add only. Changing the RULE of an existing run means rewriting days
          you may already have ticked, so an existing repeat offers exactly one
          thing: stop it. */}
      {!editing && (
        <Field label="Repeat">
          <Segmented
            ariaLabel="Repeat"
            value={rule}
            onChange={setRule}
            options={RULES.map((r) => ({ value: r, label: REPEAT_LABEL[r] }))}
          />
          {rule !== 'none' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-subtle">until</span>
              <div className="min-w-[200px] flex-1">
                <DateTimePicker
                  value={until}
                  onChange={(v) => v && setUntil(v)}
                  ariaLabel="Repeat until"
                />
              </div>
              {summary && <span className="text-[12px] text-subtle">{summary}</span>}
            </div>
          )}
        </Field>
      )}

      {editing && task.repeatGroup && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2">
          <Repeat size={13} className="shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 flex-1 text-[12px] text-subtle">
            One of a repeat. Ending it removes the days still to come and keeps the ones
            already behind you.
          </span>
          <button
            type="button"
            onClick={() => {
              removeTaskSeries(task.repeatGroup as string)
              onDone()
            }}
            className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-danger transition-colors duration-150 hover:bg-danger/10"
          >
            End repeat
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!title.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editing ? 'Save' : 'Add to my calendar'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
        >
          Cancel
        </button>

        {editing && (
          <button
            type="button"
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true)
              removeTask(task.id)
              onDone()
            }}
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors duration-150',
              confirmDelete ? 'bg-danger/15 text-danger' : 'text-subtle hover:text-danger',
            )}
          >
            <Trash2 size={13} aria-hidden />
            {confirmDelete ? 'Really delete?' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">{label}</p>
      {children}
    </div>
  )
}

/** The checklist rows. A blank line is dropped on save rather than refused, so
 *  adding a step and changing your mind is not an error to clear. */
function StepList({
  steps,
  onChange,
}: {
  steps: TaskStep[]
  onChange: (next: TaskStep[]) => void
}) {
  const set = (i: number, text: string) =>
    onChange(steps.map((s, n) => (n === i ? { ...s, text } : s)))

  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-3.5 shrink-0 rounded-[4px] border border-border-strong" aria-hidden />
          <input
            type="text"
            value={s.text}
            placeholder="Re-do problem set 4"
            aria-label={`Step ${i + 1}`}
            autoFocus={s.text === ''}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onChange([...steps, { text: '', done: false }])
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle focus-visible:border-border-strong focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(steps.filter((_, n) => n !== i))}
            aria-label={`Remove step ${i + 1}`}
            className="shrink-0 rounded-md p-1 text-subtle transition-colors duration-150 hover:text-danger"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...steps, { text: '', done: false }])}
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-accent transition-colors duration-150 hover:bg-accent-soft"
      >
        <Plus size={13} aria-hidden />
        {steps.length === 0 ? 'Add a step' : 'Another step'}
      </button>
    </div>
  )
}
