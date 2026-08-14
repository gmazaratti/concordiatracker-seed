import { useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { term } from '@/data/mock'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { currentGpa } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { groupDue, PAIN_THRESHOLD } from './due'
import { GlanceStrip } from './GlanceStrip'
import { DueList } from './DueList'
import { PainNudge } from './PainNudge'
import { PeerNudge } from './PeerNudge'
import { AnnouncementsDigest } from './AnnouncementsDigest'
import { FeedbackPrompt } from '@/features/feedback/FeedbackPrompt'
import { AdminActivityCard } from '@/features/admin/AdminActivityCard'
import { cn } from '@/lib/cn'
import { useT, useI18n } from '@/i18n/i18n'
import { useUiState } from '@/app/providers/ui-state'
import { WIDGETS_BY_ID, GLANCE_ID, DEFAULT_TOP, sanitizeLayout } from './widgets/registry'
import { AddWidgetButton } from './widgets/AddWidgetButton'
import { SortableWidgets } from './widgets/SortableWidgets'

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
export function TodayPage() {
  const t = useT()
  const { lang } = useI18n()
  const {
    user,
    plan,
    courses,
    pastCourses,
    assessments,
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
  const topWidgets = sanitizeLayout(uiState.todayTopWidgets, DEFAULT_TOP)
  // Edit mode is explicit rather than long-press-only: widgets contain links,
  // so at rest every tap would race a drag.
  const [editing, setEditing] = useState(false)
  // Items the student resolved this session — surfaced under "Completed today".
  const [resolvedIds, setResolvedIds] = useState<string[]>([])

  const groups = useMemo(() => groupDue(assessments), [assessments])
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <main className="flex min-w-0 flex-1 flex-col gap-3">
          <PeerNudge />

          {/* The band above the due list: one wide card, or two halves. Empty by
              default — this space used to be the workload panel for everyone,
              and it's now something you opt into. */}
          {topWidgets.length > 0 && (
            <SortableWidgets
              ids={topWidgets}
              editing={editing}
              axis="xy"
              onReorder={(next) => patchUiState({ todayTopWidgets: next })}
              onRemove={(id) =>
                patchUiState({ todayTopWidgets: topWidgets.filter((x) => x !== id) })
              }
              className={cn(
                'grid gap-3',
                topWidgets.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
              )}
              renderItem={(id) =>
                WIDGETS_BY_ID.get(id)?.render(topWidgets.length > 1 ? 'half' : 'wide')
              }
            />
          )}
          <DueList
            groups={groups}
            completed={completed}
            prefs={todayPrefs}
            courseById={courseById}
            onResolve={resolve}
            onDelete={deleteItem}
            onUndo={undo}
            onPrefsChange={updateTodayPrefs}
          />
          <AnnouncementsDigest />
        </main>

        <aside className="flex flex-col gap-3 lg:w-[272px] lg:shrink-0">
          {/* User-chosen widgets, in their order. The glance panel is rendered
              here rather than by the registry because it needs the term totals
              already computed above. */}
          <SortableWidgets
            ids={widgets}
            editing={editing}
            onReorder={(next) => patchUiState({ todayWidgets: next })}
            onRemove={(id) => patchUiState({ todayWidgets: widgets.filter((x) => x !== id) })}
            className="flex flex-col gap-3"
            renderItem={(id) =>
              id === GLANCE_ID ? (
                <GlanceStrip
                term={term}
                gpa={gpa}
                overdue={groups.overdue.length}
                itemsLeft={groups.count}
                nextUp={groups.nextUp}
                nextCourse={groups.nextUp ? courseById(groups.nextUp.courseId) : undefined}
                doneToday={completed.length}
                courseCount={courses.length}
                credits={credits}
                cumulativeGpa={cumulativeGpa}
                />
              ) : (
                WIDGETS_BY_ID.get(id)?.render('rail')
              )
            }
          />
          {/* Contextual nudges are NOT widgets — they appear because something
              needs attention, not because you chose them. */}
          {showPain && <PainNudge count={groups.count} />}
          <AddWidgetButton
            editing={editing}
            onToggleEditing={() => setEditing((v) => !v)}
            layout={widgets}
            onChange={(next) => patchUiState({ todayWidgets: next })}
            topLayout={topWidgets}
            onTopChange={(next) => patchUiState({ todayTopWidgets: next })}
            ctx={{ courseCount: courses.length }}
          />
        </aside>
      </div>

      <FeedbackPrompt />
    </div>
  )
}
