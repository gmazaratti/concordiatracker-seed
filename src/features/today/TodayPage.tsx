import { useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { term } from '@/data/mock'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { currentGpa } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { daysUntil } from '@/lib/date'
import { groupDue, PAIN_THRESHOLD } from './due'
import { coveredTaskIds, pairMoodleToAssessments } from '@/lib/moodle-match'
import { GlanceStrip } from './GlanceStrip'
import { DueList } from './DueList'
import { PainNudge } from './PainNudge'
import { PeerNudge } from './PeerNudge'
import { AnnouncementsDigest } from './AnnouncementsDigest'
import { FeedbackPrompt } from '@/features/feedback/FeedbackPrompt'
import { AdminActivityCard } from '@/features/admin/AdminActivityCard'
import { useT, useI18n } from '@/i18n/i18n'
import { useUiState } from '@/app/providers/ui-state'
import {
  WIDGETS_BY_ID,
  GLANCE_ID,
  DUE_ID,
  DEFAULT_MAIN,
  MAX_MAIN,
  MAX_WIDGETS,
  sanitizeLayout,
} from './widgets/registry'
import { AddWidgetButton } from './widgets/AddWidgetButton'
import { WidgetBoard, WidgetZoneView, type ZoneSpec } from './widgets/WidgetBoard'

/** Which greeting to show — the hour is read at render time, like the rest of
 * Today's clock-relative copy. */
function greetingKey(): 'today.goodMorning' | 'today.goodAfternoon' | 'today.goodEvening' {
  const h = new Date().getHours()
  if (h < 12) return 'today.goodMorning'
  if (h < 18) return 'today.goodAfternoon'
  return 'today.goodEvening'
}

/** Today — one calm, informative screen: a glance strip, the optional pain-moment
 * nudge, and the scannable Due list at its heart. */
/** Overdue and near-term totals for Moodle rows. Module-level so reading the
 *  clock is allowed (`react-hooks/purity` bars it inside a component). */
function countNear(tasks: { due: string }[]): { overdue: number; near: number } {
  let overdue = 0
  let near = 0
  for (const tk of tasks) {
    const d = daysUntil(tk.due)
    if (d < 0) overdue++
    if (d < 7) near++
  }
  return { overdue, near }
}

export function TodayPage() {
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
    setStatus,
    removeAssessment,
    addAssessments,
    courseById,
    todayPrefs,
    updateTodayPrefs,
  } = useAppData()
  const { flashUndo } = useQuickActions()
  const { uiState, patchUiState } = useUiState()
  // Unknown ids are dropped, so a layout saved against an older build can never
  // crash Today or render a widget twice.
  const widgets = sanitizeLayout(uiState.todayWidgets)
  /**
   * The wide column, migrating the old two-band layout on read.
   *
   * Anyone who had put something above or below their deadlines keeps exactly
   * the arrangement they had — the list simply says so explicitly now, with
   * the due list in the middle where it always was.
   */
  const savedMain =
    uiState.todayMain ??
    [...(uiState.todayTopWidgets ?? []), DUE_ID, ...(uiState.todayBelowWidgets ?? [])]
  const rawMain = sanitizeLayout(savedMain, DEFAULT_MAIN)
  // The one invariant: the due list is on this screen somewhere. A saved
  // layout that has lost it (an old write, a bad merge) gets it back at the
  // top rather than rendering a Today with no deadlines on it.
  const mainWidgets =
    rawMain.includes(DUE_ID) || widgets.includes(DUE_ID) ? rawMain : [DUE_ID, ...rawMain]
  // Edit mode is explicit rather than long-press-only: widgets contain links,
  // so at rest every tap would race a drag.
  const [editing, setEditing] = useState(false)

  /**
   * Zones are exclusive: a widget lives in exactly one. Writing both at once
   * means dragging the due list into the rail removes it from the main column
   * in the same update, instead of showing it twice or silently refusing.
   */
  function setZone(zone: 'rail' | 'main', next: string[]) {
    const others = (list: string[]) => list.filter((id) => !next.includes(id))
    patchUiState({
      todayWidgets: zone === 'rail' ? next : others(widgets),
      todayMain: zone === 'main' ? next : others(mainWidgets),
    })
  }
  // Items the student resolved this session — surfaced under "Completed today".
  const [resolvedIds, setResolvedIds] = useState<string[]>([])

  const groups = useMemo(() => groupDue(assessments), [assessments])

  /**
   * Moodle deadlines that are NOT a second copy of something already here.
   *
   * THIS IS THE DUPLICATE ANSWER. A synced "Assignment 2 is due" and the
   * Assignment 2 on your course are the same piece of work, and showing both
   * would double the list for anyone whose syllabus is also in Moodle. The
   * assessment wins — it carries the weight and your grade — and the synced
   * copy is dropped. What survives is the deadlines no syllabus lists, which
   * is exactly what connecting Moodle was for.
   *
   * Anything still open, and undone.
   */
  const moodleDue = useMemo(() => {
    const covered = coveredTaskIds(pairMoodleToAssessments(personalTasks, assessments, courses))
    return personalTasks.filter((tk) => tk.source === 'moodle' && !tk.done && !covered.has(tk.id))
  }, [personalTasks, assessments, courses])
  /**
   * The same two numbers the rail shows, for the Moodle half.
   *
   * Counted here rather than left out, because a rail reading "3 left" beside
   * a list of five rows is the kind of small inconsistency that makes someone
   * distrust both numbers.
   */
  const moodleCounts = useMemo(() => countNear(moodleDue), [moodleDue])

  const gpa = useMemo(() => currentGpa(courses, assessments), [courses, assessments])
  // Cumulative across FINISHED terms — the sub-line under this term's GPA.
  const cumulativeGpa = useMemo(
    () => (pastCourses.length ? currentGpa(pastCourses, assessments) : null),
    [pastCourses, assessments],
  )

  const completed = resolvedIds
    .map((id) => assessments.find((a) => a.id === id))
    .filter((a): a is Assessment => !!a && !isOpen(a.status))

  function resolve(id: string, status: AssessmentStatus) {
    setResolvedIds((prev) => (prev.includes(id) ? prev : [id, ...prev]))
    setStatus(id, status)
  }
  function undo(id: string) {
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
  const showPain = plan === 'free' && groups.count >= PAIN_THRESHOLD
  const credits = courses.reduce((sum, c) => sum + c.credits, 0)

  // Zones are declared once so the drag controller and the views agree on
  // capacity, layout, and where a widget currently lives.
  const zones: ZoneSpec[] = [
    { id: 'main', ids: mainWidgets, setIds: (n) => setZone('main', n), layout: 'wide', max: MAX_MAIN },
    { id: 'rail', ids: widgets, setIds: (n) => setZone('rail', n), layout: 'rail', max: MAX_WIDGETS },
  ]
  const zoneById = (id: string) => zones.find((z) => z.id === id)!

  const dueList = (compact: boolean) => (
    <DueList
      compact={compact}
      groups={groups}
      moodle={moodleDue}
      completed={completed}
      prefs={todayPrefs}
      courseById={courseById}
      onResolve={resolve}
      onDelete={deleteItem}
      onUndo={undo}
      onToggleMoodle={toggleTask}
      onPrefsChange={updateTodayPrefs}
    />
  )

  const glance = (
    <GlanceStrip
      term={term}
      gpa={gpa}
      overdue={groups.overdue.length + moodleCounts.overdue}
      itemsLeft={groups.count + moodleCounts.near}
      nextUp={groups.nextUp}
      nextCourse={groups.nextUp ? courseById(groups.nextUp.courseId) : undefined}
      doneToday={completed.length}
      courseCount={courses.length}
      credits={credits}
      cumulativeGpa={cumulativeGpa}
    />
  )

  /** Both zones render the same three special cases; only the size differs. */
  const renderIn = (zone: 'main' | 'rail') => (id: string) => {
    if (id === DUE_ID) return dueList(zone === 'rail')
    if (id === GLANCE_ID) return glance
    return WIDGETS_BY_ID.get(id)?.render(zone === 'rail' ? 'rail' : 'wide')
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <header className="mb-3">
        <p className="text-[12px] text-subtle">
          {new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }).format(new Date())}
        </p>
        <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
          {t(greetingKey())}, {firstName}
        </h1>
      </header>

      {/* Admin-only platform activity inbox (renders nothing for everyone else) */}
      <AdminActivityCard />

      <WidgetBoard
        zones={zones}
        editing={editing}
        onRequestEdit={() => setEditing(true)}
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
            className="flex flex-col gap-3"
            renderItem={renderIn('main')}
          />
          <AnnouncementsDigest />
        </main>

        <aside className="flex flex-col gap-3 lg:w-[272px] lg:shrink-0">
          {/* User-chosen widgets, in their order. The glance panel and the due
              list are rendered here rather than by the registry because they
              need the term totals and the write handlers computed above. */}
          <WidgetZoneView
            zone={zoneById('rail')}
            emptyHint="Drop a widget here"
            className="flex flex-col gap-3"
            renderItem={renderIn('rail')}
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
