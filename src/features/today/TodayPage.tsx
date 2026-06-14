import { useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import type { Assessment } from '@/data/types'
import { currentGpa } from '@/lib/gpa'
import { groupDue, PAIN_THRESHOLD } from './due'
import { GlanceStrip } from './GlanceStrip'
import { DueList } from './DueList'
import { PainNudge } from './PainNudge'

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
  const { user, plan, courses, assessments, toggleDone, courseById } = useAppData()
  const [completedIds, setCompletedIds] = useState<string[]>([])

  const groups = useMemo(() => groupDue(assessments), [assessments])
  const gpa = useMemo(() => currentGpa(courses, assessments), [courses, assessments])

  const completed = completedIds
    .map((id) => assessments.find((a) => a.id === id))
    .filter((a): a is Assessment => !!a && a.done)

  function complete(id: string) {
    setCompletedIds((prev) => (prev.includes(id) ? prev : [id, ...prev]))
    toggleDone(id)
  }
  function undo(id: string) {
    setCompletedIds((prev) => prev.filter((x) => x !== id))
    toggleDone(id)
  }

  const firstName = user.name.split(' ')[0]
  const showPain = plan === 'free' && groups.count >= PAIN_THRESHOLD

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-[12px] text-subtle">{TODAY_LABEL.format(new Date())}</p>
        <h1 className="mt-1 font-display text-[28px] leading-tight font-medium text-fg">
          {greeting()}, {firstName}
        </h1>
      </header>

      <div className="space-y-5">
        <GlanceStrip
          gpa={gpa}
          itemsLeft={groups.count}
          nextUp={groups.nextUp}
          nextCourse={groups.nextUp ? courseById(groups.nextUp.courseId) : undefined}
        />
        {showPain && <PainNudge count={groups.count} />}
        <DueList
          groups={groups}
          completed={completed}
          courseById={courseById}
          onComplete={complete}
          onUndo={undo}
        />
      </div>
    </div>
  )
}
