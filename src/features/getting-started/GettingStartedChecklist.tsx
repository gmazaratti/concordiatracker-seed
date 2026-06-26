import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Rocket, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { isOpen } from '@/lib/status'
import { gradeToPercent } from '@/lib/grade'
import { cn } from '@/lib/cn'

interface Step {
  id: string
  label: string
  hint: string
  done: boolean
  to: string
}

/**
 * A light, dismissible "Getting started" card (bottom-right) that fills in as the
 * user does the real first actions. Completion is DERIVED from their actual data
 * (+ the community-visited flag), so it's always honest — never a separate to-do
 * list. Hidden once everything's done, or once dismissed (persisted per user).
 */
export function GettingStartedChecklist() {
  const { courses, assessments } = useAppData()
  const { uiState, loaded, patchUiState } = useUiState()
  const [open, setOpen] = useState(true)

  const steps: Step[] = [
    {
      id: 'course',
      label: 'Add a course',
      hint: 'Import a syllabus or pick a blueprint',
      done: courses.length > 0,
      to: '/app/courses',
    },
    {
      id: 'assignment',
      label: 'Add an assignment',
      hint: 'A deadline to track',
      done: assessments.length > 0,
      to: '/app/courses',
    },
    {
      id: 'done',
      label: 'Mark one done',
      hint: 'Tap the circle on a task',
      done: assessments.some((a) => !isOpen(a.status)),
      to: '/app',
    },
    {
      id: 'grade',
      label: 'Enter a grade',
      hint: 'See your standing update',
      done: assessments.some((a) => gradeToPercent(a.grade) !== null),
      to: '/app/courses',
    },
    {
      id: 'community',
      label: 'Explore Community',
      hint: 'Events around campus',
      done: !!uiState.communityVisited,
      to: '/app/community',
    },
  ]

  const completed = steps.filter((s) => s.done).length
  const allDone = completed === steps.length

  // Wait for the flags to load (so it doesn't flash), and bow out once finished
  // or dismissed.
  if (!loaded || uiState.checklistDismissed || allDone) return null

  return (
    <section
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--ct-shadow)] md:bottom-5"
      aria-label="Getting started"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Rocket size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg">Getting started</p>
          <p className="text-[12px] text-subtle">{completed} of {steps.length} done</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={open}
          className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ChevronDown
            size={16}
            className={cn('transition-transform duration-150', !open && '-rotate-90')}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => patchUiState({ checklistDismissed: true })}
          aria-label="Dismiss getting started"
          className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {open && (
        <ul className="border-t border-border">
          {steps.map((s) =>
            s.done ? (
              <li
                key={s.id}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
                  <Check size={12} strokeWidth={3} aria-hidden />
                </span>
                <span className="text-subtle line-through">{s.label}</span>
              </li>
            ) : (
              <li key={s.id}>
                <Link
                  to={s.to}
                  className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-surface-2/50"
                >
                  <span className="size-5 shrink-0 rounded-full border-2 border-dashed border-border-strong" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-fg">{s.label}</span>
                    <span className="block truncate text-[11px] text-subtle">{s.hint}</span>
                  </span>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="flex items-center gap-3 border-t border-border px-4 py-2.5">
        <span className="shrink-0 text-[12px] font-semibold text-accent tabular-nums">
          {completed} of {steps.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </section>
  )
}
