import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronDown, Play, Rocket, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { completePrompt, usePromptSlot } from '@/app/first-run'
import { useTour } from '@/features/tour/tour'
import { TOUR_STEPS } from '@/features/tour/steps'
import { isOpen } from '@/lib/status'
import { gradeToPercent } from '@/lib/grade'
import { cn } from '@/lib/cn'
import { ChecklistDone, StepRow, type Step } from './checklist-parts'
import { readActive, readOpen, writeActive, writeOpen } from './checklist-storage'

/**
 * A light, dismissible "Getting started" card (bottom-right) that fills in as the
 * user does the real first actions. Completion is DERIVED from their actual data
 * (+ the community-visited flag), so it's always honest — never a separate to-do
 * list. Hidden once everything's done, or once dismissed (persisted per user).
 */
export function GettingStartedChecklist() {
  const { courses, assessments, dataLoading } = useAppData()
  const { pathname, search } = useLocation()
  const { uiState, loaded, patchUiState } = useUiState()
  // First in the queue: it is the only one of the four about the product's
  // actual job, so it earns the opening slot.
  const slot = usePromptSlot('checklist')
  const { start } = useTour()
  // Open the first time it is seen; after that it stays however it was left
  // for the rest of the session.
  const [open, setOpen] = useState(() => readOpen())
  useEffect(() => writeOpen(open), [open])
  const cardRef = useRef<HTMLElement>(null)

  /*
   * IT GETS OUT OF THE WAY ONCE YOU START WORKING. Expanded, this card is
   * 300×360px of fixed position in the bottom-right corner, and it stayed that
   * way while you used the page — so on a course's Edit tab it sat over the Due
   * column, and every date button below the first row looked blank (QA,
   * 2026-09-26). The first press anywhere else collapses it to its header; the
   * chevron (or the "maybe later" nudge) brings it back.
   */
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  // And the page can always scroll its last row clear of it: the app's scroller
  // gets bottom padding the height of the card for as long as it is on screen.
  useEffect(() => {
    const el = cardRef.current
    const main = document.getElementById('app-main')
    if (!el || !main) return
    const apply = () => main.style.setProperty('--ct-float-pad', `${el.offsetHeight + 24}px`)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      main.style.removeProperty('--ct-float-pad')
    }
  })
  // Brief attention pulse when the user declines the tour ("maybe later"), so the
  // eye lands on this passive helper. Auto-clears; expands the card if collapsed.
  const [nudge, setNudge] = useState(false)
  useEffect(() => {
    const onShow = () => {
      setOpen(true)
      setNudge(true)
      window.setTimeout(() => setNudge(false), 2600)
    }
    window.addEventListener('ct:show-checklist', onShow)
    return () => window.removeEventListener('ct:show-checklist', onShow)
  }, [])

  // Both steps happen INSIDE a course, and both used to link to the Courses
  // list — which is usually the page you are already on, so the link did
  // nothing at all. They open a real course now: the newest one for adding an
  // assignment, and one that has assessments for entering a grade.
  const newestCourse = courses[courses.length - 1]
  const gradable = courses.find((c) => assessments.some((a) => a.courseId === c.id)) ?? newestCourse
  const courseHref = (id: string | undefined) => (id ? `/app/courses/${id}` : '/app/courses')

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
      to: courseHref(newestCourse?.id),
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
      to: courseHref(gradable?.id),
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
  const next = steps.find((s) => !s.done)

  /*
   * WHAT JUST GOT FINISHED. The done flags are derived from real data, so the
   * only way to know a step was completed NOW (and not before the page loaded)
   * is to remember what was done last render. The first answer after data
   * loads is the baseline and animates nothing; any step that flips to done
   * after it gets its moment. Adjusted during render, not in an effect, so the
   * flash is in the same frame as the change.
   */
  const doneKey = steps.filter((s) => s.done).map((s) => s.id).join(',')
  const ready = loaded && !dataLoading
  const [seen, setSeen] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string[]>([])
  const [celebrate, setCelebrate] = useState(false)
  if (ready && seen === null) setSeen(doneKey)
  else if (ready && seen !== null && seen !== doneKey) {
    const before = new Set(seen.split(',').filter(Boolean))
    const added = steps.filter((s) => s.done && !before.has(s.id)).map((s) => s.id)
    setSeen(doneKey)
    if (added.length > 0) {
      setFresh(added)
      setOpen(true)
      if (allDone) setCelebrate(true)
    }
  }
  useEffect(() => {
    if (fresh.length === 0) return
    const t = window.setTimeout(() => setFresh([]), 1800)
    return () => window.clearTimeout(t)
  }, [fresh])
  useEffect(() => {
    if (!celebrate) return
    const t = window.setTimeout(() => setCelebrate(false), 6000)
    return () => window.clearTimeout(t)
  }, [celebrate])

  // The step the student tapped: pulses until it is done or another is picked.
  const [active, setActive] = useState<string | null>(() => readActive())
  const go = (id: string) => {
    setActive(id)
    writeActive(id)
    // Out of the way of the page the step just opened.
    setOpen(false)
  }

  // Messages is a conversation screen: the card would sit on the composer, and
  // no step happens there.
  const onMessages = /\/app\/community/.test(pathname) && new URLSearchParams(search).get('c') === 'messages'

  if (celebrate) return <ChecklistDone onClose={() => setCelebrate(false)} />

  // Dismissed or finished, the queue moves on. Reported from render-adjacent
  // state rather than an effect, because completePrompt only writes storage and
  // fires an event — it sets no React state of its own.
  if (loaded && (uiState.checklistDismissed || allDone)) completePrompt('checklist')
  if (!loaded || uiState.checklistDismissed || allDone || !slot || onMessages) return null

  return (
    <section
      ref={cardRef}
      className={cn(
        'fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-surface shadow-[var(--ct-shadow)] md:bottom-5',
        nudge ? 'ct-attention border-accent' : 'border-border',
      )}
      aria-label="Getting started"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Rocket size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg">Getting started</p>
          <p className="truncate text-[12px] text-subtle">
            <span key={completed} className="ct-count inline-block font-medium text-accent">
              {completed} of {steps.length}
            </span>{' '}
            {!open && next ? `· Next: ${next.label}` : 'done'}
          </p>
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
          {steps.map((s) => (
            <StepRow
              key={s.id}
              step={s}
              fresh={fresh.includes(s.id)}
              active={active === s.id && !s.done}
              onGo={() => go(s.id)}
            />
          ))}
        </ul>
      )}

      {open && (
        <button
          type="button"
          onClick={() => start(TOUR_STEPS)}
          className="flex w-full items-center justify-center gap-2 border-t border-border px-4 py-2.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-surface-2/40"
        >
          <Play size={13} aria-hidden />
          Take a quick tour
        </button>
      )}

      {open && (
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
      )}
    </section>
  )
}
