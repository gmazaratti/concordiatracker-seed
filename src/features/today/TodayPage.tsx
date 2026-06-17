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

const TODAY_LABEL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Today — one calm, informative screen: a glance strip, the optional pain-moment
 * nudge, and the scannable Due list at its heart. */
export function TodayPage() {
  const {
    user,
    plan,
    courses,
    assessments,
    setStatus,
    removeAssessment,
    addAssessments,
    courseById,
    todayPrefs,
    updateTodayPrefs,
  } = useAppData()
  const { flashUndo } = useQuickActions()
  // Items the student resolved this session — surfaced under "Completed today".
  const [resolvedIds, setResolvedIds] = useState<string[]>([])

  const groups = useMemo(() => groupDue(assessments), [assessments])
  const gpa = useMemo(() => currentGpa(courses, assessments), [courses, assessments])

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
    if (item) flashUndo(`Deleted ${item.title}`, () => addAssessments([item]))
  }

  const firstName = user.name.split(' ')[0]
  const showPain = plan === 'free' && groups.count >= PAIN_THRESHOLD
  const credits = courses.reduce((sum, c) => sum + c.credits, 0)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <header className="mb-3">
        <p className="text-[12px] text-subtle">{TODAY_LABEL.format(new Date())}</p>
        <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
          {greeting()}, {firstName}
        </h1>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <main className="order-2 flex min-w-0 flex-1 flex-col gap-3 lg:order-1">
          <PeerNudge />
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
        </main>

        <aside className="order-1 flex flex-col gap-3 lg:order-2 lg:w-[272px] lg:shrink-0">
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
          />
          {showPain && <PainNudge count={groups.count} />}
        </aside>
      </div>
    </div>
  )
}
