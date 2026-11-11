import { createPortal } from 'react-dom'
import { askForGrade, askForTaskGrade } from '@/lib/grade-prompt'
import { useShownGpa } from '@/app/hooks/useShownGpa'
import { haptic } from '@/lib/haptics'
import { useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { term } from '@/data/mock'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { currentGpa } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { groupDue, PAIN_THRESHOLD } from './due'
import { GlanceStrip } from './GlanceStrip'
import { TodayHero } from './TodayHero'
import { Link } from 'react-router-dom'
import { DueList } from './DueList'
import { PainNudge } from './PainNudge'
import { PeerNudge } from './PeerNudge'
import { DiscoverCard } from '@/features/discovery/DiscoverCard'
import { ARRIVE_KEY } from '@/features/onboarding/flow/ob-data'
import { cn } from '@/lib/cn'
import { AnnouncementsDigest } from './AnnouncementsDigest'
import { FeedbackPrompt } from '@/features/feedback/FeedbackPrompt'
import { AdminActivityCard } from '@/features/admin/AdminActivityCard'
import { useT, useI18n } from '@/i18n/i18n'
import { SIZE_SPAN, WIDGETS_BY_ID, GLANCE_ID, DUE_ID, sizesFor, zoneForSize, type WidgetSize } from './widgets/registry'
import { AddWidgetButton } from './widgets/AddWidgetButton'
import { SizePicker } from './widgets/SizePicker'
import { WidgetBoard, WidgetZoneView } from './widgets/WidgetBoard'
import { greetingKey, useTodosDue } from './today-helpers'
import { useTodayLayout } from './useTodayLayout'
import { useUiState } from '@/app/providers/ui-state'
import { dayKey, isSnoozed, snoozeUntilTomorrow, unsnooze } from '@/lib/snooze'

/** Today — one calm, informative screen: a glance strip, the optional pain-moment
 * nudge, and the scannable Due list at its heart. */
export function TodayPage({
  preview = false,
}: {
  /** The proposed look, at /app/today/preview: a banner, a wider page and the
   *  new card style (scoped by `.ct-today-next` in index.css). Same data, same
   *  handlers, so everything on it works. */
  preview?: boolean
} = {}) {
  const t = useT()
  const { lang } = useI18n()
  const {
    user,
    plan,
    courses,
    pastCourses,
    assessments,
    personalTasks,
    toggleTask,
    updateTask,
    setStatus,
    removeAssessment,
    addAssessments,
    courseById,
    todayPrefs,
    updateTodayPrefs,
  } = useAppData()
  const { flashUndo } = useQuickActions()
  // Set by onboarding as it leaves (flow/ob-data → ARRIVE_KEY). Read once, then
  // cleared, so only that first landing plays the entrance.
  const [arriving] = useState(() => {
    try {
      const on = sessionStorage.getItem(ARRIVE_KEY) === '1'
      if (on) sessionStorage.removeItem(ARRIVE_KEY)
      return on
    } catch {
      return false
    }
  })
  const { widgets, mainWidgets, setZone, zones, sizeFor, setSize, railSizes, growFromRail } =
    useTodayLayout()
  // Edit mode is explicit rather than long-press-only: widgets contain links,
  // so at rest every tap would race a drag.
  const [editing, setEditing] = useState(false)
  // Items the student resolved this session — surfaced under "Completed today".
  const [resolvedIds, setResolvedIds] = useState<string[]>([])

  const { uiState, patchUiState } = useUiState()
  // "Not today" hides a row until tomorrow. Read once per render; the day only
  // matters to the minute, and a reload after midnight brings everything back.
  const [today] = useState(() => dayKey(new Date()))
  const snoozed = uiState.snoozed
  const visible = useMemo(
    () => assessments.filter((a) => !isSnoozed(snoozed, a.id, today)),
    [assessments, snoozed, today],
  )
  const snoozedCount = assessments.length - visible.length
  // Everything ticked off this session, of either kind: the reward bar counts
  // what you actually did, not only what landed in "Completed today".
  const [doneCount, setDoneCount] = useState(0)

  const groups = useMemo(() => groupDue(visible), [visible])

  // Tasks written in Notes can be hidden from Today without leaving Notes.
  const todayTasks = useMemo(
    () => (todayPrefs.showNoteTasks === false ? personalTasks.filter((tk) => !tk.noteId) : personalTasks),
    [personalTasks, todayPrefs.showNoteTasks],
  )
  const { todosDue, todoCounts } = useTodosDue(todayTasks, assessments, courses)

  const shown = useShownGpa()
  const gpa = useMemo(() => currentGpa(courses, assessments), [courses, assessments])
  // Cumulative across FINISHED terms — the sub-line under this term's GPA.
  const cumulativeGpa = useMemo(
    () => (pastCourses.length ? currentGpa(pastCourses, assessments) : null),
    [pastCourses, assessments],
  )

  // Submitted-but-ungraded work shows in its own section, so it is left out of
  // "Completed today" rather than appearing twice.
  const completed = resolvedIds
    .map((id) => assessments.find((a) => a.id === id))
    .filter((a): a is Assessment => !!a && !isOpen(a.status) && a.status !== 'awaiting-grade')
  const awaiting = useMemo(
    () =>
      assessments
        .filter((a) => a.status === 'awaiting-grade' && !a.grade)
        .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')),
    [assessments],
  )

  function resolve(id: string, status: AssessmentStatus) {
    // "Mark graded" on a submitted item is the student saying there is no grade
    // to type: file it as done without asking for one.
    const wasAwaiting = assessments.find((a) => a.id === id)?.status === 'awaiting-grade'
    setResolvedIds((prev) => (prev.includes(id) ? prev : [id, ...prev]))
    setStatus(id, status)
    if (status === 'done' || status === 'awaiting-grade') {
      if (!wasAwaiting) setDoneCount((n) => n + 1)
    }
    // Finished: a tick you can feel, then an offer to record the grade (a
    // small card, never a dialog).
    if (status === 'done') {
      haptic('success')
      if (!wasAwaiting) askForGrade(id)
    } else if (status === 'awaiting-grade') {
      haptic('tap')
    }
  }
  /** A synced Moodle item: same tick, same feel, same "what did you get?". */
  function toggleMoodle(id: string) {
    const task = personalTasks.find((tk) => tk.id === id)
    toggleTask(id)
    if (task && !task.done) {
      setDoneCount((n) => n + 1)
      haptic('success')
      askForTaskGrade(id)
    }
  }
  /** Tick one line of a task's checklist without opening anything. */
  function toggleStep(id: string, index: number) {
    const task = personalTasks.find((tk) => tk.id === id)
    if (!task?.steps) return
    updateTask(id, {
      steps: task.steps.map((s, n) => (n === index ? { ...s, done: !s.done } : s)),
    })
  }
  function snooze(id: string) {
    const item = assessments.find((a) => a.id === id)
    const before = uiState.snoozed
    patchUiState({ snoozed: snoozeUntilTomorrow(before, id, new Date()) })
    haptic('tap')
    if (item) flashUndo(t('today.pushedTomorrow', { title: item.title }), () => patchUiState({ snoozed: unsnooze(before, id) }))
  }
  function undo(id: string) {
    setDoneCount((n) => Math.max(0, n - 1))
    setResolvedIds((prev) => prev.filter((x) => x !== id))
    setStatus(id, 'not-started')
  }
  // Delete removes the item from the store; a transient Undo restores it intact.
  function deleteItem(id: string) {
    const item = assessments.find((a) => a.id === id)
    setResolvedIds((prev) => prev.filter((x) => x !== id))
    removeAssessment(id)
    if (item) flashUndo(t('today.deleted', { title: item.title }), () => addAssessments([item]))
  }

  const firstName = user.name.split(' ')[0]
  const dateLabel = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
  const showPain = plan === 'free' && groups.count >= PAIN_THRESHOLD
  const credits = courses.reduce((sum, c) => sum + c.credits, 0)

  const zoneById = (id: string) => zones.find((z) => z.id === id)!

  const dueList = (compact: boolean) => (
    <DueList
      compact={compact}
      groups={groups}
      moodle={todosDue}
      completed={completed}
      awaiting={awaiting}
      prefs={todayPrefs}
      courseById={courseById}
      onResolve={resolve}
      onSnooze={snooze}
      snoozedCount={snoozedCount}
      onBringBack={() => patchUiState({ snoozed: unsnooze(uiState.snoozed) })}
      doneCount={doneCount}
      onDelete={deleteItem}
      onUndo={undo}
      onToggleMoodle={toggleMoodle}
      onToggleStep={toggleStep}
      onPrefsChange={updateTodayPrefs}
    />
  )

  const glance = (
    <GlanceStrip
      term={term}
      gpa={shown(gpa)}
      overdue={groups.overdue.length + todoCounts.overdue}
      itemsLeft={groups.count + todoCounts.near}
      nextUp={groups.nextUp}
      nextCourse={groups.nextUp ? courseById(groups.nextUp.courseId) : undefined}
      doneToday={completed.length}
      courseCount={courses.length}
      credits={credits}
      cumulativeGpa={shown(cumulativeGpa)}
    />
  )

  /** Both zones render the same three special cases; only the size differs. */
  const renderIn = (zone: 'main' | 'rail') => (id: string) => {
    const size: WidgetSize = zone === 'rail' ? 's' : sizeFor(id)
    if (id === DUE_ID) return dueList(size === 's')
    if (id === GLANCE_ID) return glance
    return WIDGETS_BY_ID.get(id)?.render(zoneForSize(size))
  }

  return (
    <div className={cn('mx-auto w-full px-5 py-5 sm:px-6', preview ? 'ct-today-next max-w-[1600px]' : 'max-w-5xl', arriving && 'ct-today-arrive')}>
      {/* Straight from onboarding: the accent curtain it left with fades off Today. */}
      {/* PORTALLED to <body>, never a child of this div: `.ct-today-arrive > *`
          gives every direct child the rise-in animation, and as a child the
          veil took that instead of its own fade. It started invisible (so the
          dashboard flashed), then rose to solid green and stayed there. */}
      {arriving && createPortal(<div className="ct-arrive-veil pointer-events-none fixed inset-0 z-[60] bg-accent" aria-hidden />, document.body)}
      {preview ? (
        <>
          <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed border-border-strong px-4 py-2.5 text-[13px] text-muted">
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-accent-contrast uppercase">Preview</span>
            A proposed look for Today. Everything on it works on your real account.
            <Link to="/app" className="ml-auto font-medium text-accent hover:underline">
              Back to Today
            </Link>
          </p>
          <TodayHero
            date={dateLabel}
            greeting={`${t(greetingKey())}, ${firstName}`}
            left={groups.count + todoCounts.near}
            overdue={groups.overdue.length + todoCounts.overdue}
            next={groups.nextUp}
            nextCourse={groups.nextUp ? courseById(groups.nextUp.courseId) : undefined}
            gpa={shown(gpa)}
          />
        </>
      ) : (
      <header className="mb-3">
        <p className="text-[12px] text-subtle">
          {dateLabel}
        </p>
        <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
          {t(greetingKey())}, {firstName}
        </h1>
      </header>
      )}

      {/* Admin-only platform activity inbox (renders nothing for everyone else) */}
      <AdminActivityCard />

      <WidgetBoard
        zones={zones}
        editing={editing}
        onRequestEdit={() => setEditing((v) => !v)}
        renderGhost={renderIn('rail')}
      >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <main className="flex min-w-0 flex-1 flex-col gap-3">
          <PeerNudge />

          {/* One ordered column. The due list is an item in it, so a widget
              can sit above it, below it, or take its place while it moves to
              the rail — which is three arrangements the old fixed-middle
              layout could not express. */}
          <WidgetZoneView
            zone={zoneById('main')}
            emptyHint="Drop a widget here"
            className="grid grid-cols-1 gap-3 sm:grid-cols-6"
            renderItem={renderIn('main')}
            itemClass={(id) => SIZE_SPAN[sizeFor(id)]}
            renderControls={(id) => {
              const def = WIDGETS_BY_ID.get(id)
              return def ? (
                <SizePicker
                  sizes={sizesFor(def)}
                  value={sizeFor(id)}
                  onChange={(sz) => setSize(id, sz)}
                  name={def.name}
                />
              ) : null
            }}
          />
          <AnnouncementsDigest />
        </main>

        <aside className={cn('flex flex-col gap-3 lg:shrink-0', preview ? 'lg:w-[340px]' : 'lg:w-[272px]')}>
          {!editing && <DiscoverCard />}
          {/* User-chosen widgets, in their order. The glance panel and the due
              list are rendered here rather than by the registry because they
              need the term totals and the write handlers computed above. */}
          <WidgetZoneView
            zone={zoneById('rail')}
            emptyHint="Drop a widget here"
            className="flex flex-col gap-3"
            renderItem={renderIn('rail')}
            renderControls={(id) => {
              const def = WIDGETS_BY_ID.get(id)
              return def ? (
                <SizePicker
                  sizes={railSizes(id)}
                  value="s"
                  onChange={(sz) => growFromRail(id, sz)}
                  name={def.name}
                />
              ) : null
            }}
          />
          {/* Contextual nudges are NOT widgets: they appear because something
              needs attention, not because you chose them. */}
          {showPain && <PainNudge count={groups.count} />}
          <AddWidgetButton
            editing={editing}
            onToggleEditing={() => setEditing((v) => !v)}
            layout={widgets}
            onChange={(next) => setZone('rail', next)}
            mainLayout={mainWidgets}
            onMainChange={(next: string[]) => setZone('main', next)}
            ctx={{ courseCount: courses.length }}
          />
        </aside>
      </div>
      </WidgetBoard>

      <FeedbackPrompt />
    </div>
  )
}
