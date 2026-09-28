import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Assessment, CalendarTask, Course } from '@/data/types'
import { applyReminderPlan, planReminders } from '@/lib/assignment-reminders'
import {
  currentDeadlineActivity,
  endDeadlineActivity,
  registerLiveActivityToken,
  showDeadlineActivity,
  spotlightReplaceAll,
  type SpotlightItem,
} from '@/lib/native-extras'
import { courseColor } from '@/lib/course-color'
import { isOpen } from '@/lib/status'
import { useReminderPrefs } from './useReminderPrefs'

/** How often the Live Activity decision is re-made while the app is open. */
const TICK_MS = 60_000

/**
 * Keeps the phone's native surfaces in step with the student's deadlines:
 *
 * - LOCAL NOTIFICATIONS: every reminder that should be pending
 *   (lib/assignment-reminders).
 * - SPOTLIGHT: every open, dated assignment is searchable from the Home Screen
 *   and opens straight into it. Rebuilt from scratch each time, so a finished
 *   or deleted assignment leaves the index on the next pass.
 * - THE LIVE ACTIVITY: the next assignment due inside the window gets the
 *   Lock Screen card and the Dynamic Island. When it is marked done the card
 *   ends on "Done"; when its time passes it ends on "Overdue". On iOS 26 the
 *   next one is also SCHEDULED to start by itself at the edge of the window,
 *   so it appears even if the app is never opened in between.
 *
 * Nothing here runs outside the iPhone app. Debounced, because a grade typed
 * digit by digit is several changes and one intention.
 */
export function useNativeDeadlineSync(
  assessments: Assessment[],
  courses: Course[],
  tasks: CalendarTask[],
  ready: boolean,
) {
  const [prefs] = useReminderPrefs()

  // Once per session: the token that lets the server start the Live Activity
  // while the app is closed.
  useEffect(() => {
    if (ready && Capacitor.isNativePlatform()) void registerLiveActivityToken()
  }, [ready])

  useEffect(() => {
    if (!ready || !Capacitor.isNativePlatform()) return
    let cancelled = false

    const run = async () => {
      const [as, cs, ts, p] = [assessments, courses, tasks, prefs]
      await applyReminderPlan(
        planReminders({ assessments: as, courses: cs, tasks: ts, enabled: p.enabled, defaults: p.defaults, tone: p.tone }),
      )
      if (cancelled) return
      await spotlightReplaceAll(spotlightItems(as, cs))
      if (cancelled) return
      await syncLiveActivity(as, cs, p.liveActivity, p.liveWindowHours)
    }

    const timer = window.setTimeout(() => void run(), 1500)
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run()
    }, TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ready, assessments, courses, tasks, prefs])
}

function spotlightItems(assessments: Assessment[], courses: Course[]): SpotlightItem[] {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const items: SpotlightItem[] = []
  for (const a of assessments) {
    if (!isOpen(a.status)) continue
    const c = byId.get(a.courseId)
    if (!c) continue
    items.push({
      id: a.id,
      title: a.title || 'Untitled',
      subtitle: [c.code, c.title].filter(Boolean).join(' · '),
      path: `/app/courses/${c.id}?focus=${a.id}`,
      dueISO: a.due,
    })
  }
  return items
}

async function syncLiveActivity(assessments: Assessment[], courses: Course[], enabled: boolean, windowHours: number) {
  const running = await currentDeadlineActivity()
  if (!enabled) {
    if (running) await endDeadlineActivity('none')
    return
  }
  const now = Date.now()
  const windowMs = windowHours * 3_600_000
  const next = assessments
    .filter((a) => a.due && isOpen(a.status) && Date.parse(a.due) > now)
    .sort((x, y) => Date.parse(x.due!) - Date.parse(y.due!))[0]

  // What happened to the one on screen decides how it ends.
  if (running && running !== next?.id) {
    const was = assessments.find((a) => a.id === running)
    const outcome = !was ? 'none' : !isOpen(was.status) ? 'done' : was.due && Date.parse(was.due) <= now ? 'overdue' : 'none'
    await endDeadlineActivity(outcome)
  }
  if (!next?.due) return
  // Outside the window it waits: the server's push-to-start (or the next time
  // the app is open inside the window) starts it.
  if (Date.parse(next.due) - windowMs > now) return
  const course = courses.find((c) => c.id === next.courseId)
  await showDeadlineActivity({
    assessmentId: next.id,
    title: next.title || 'Untitled',
    course: course?.code ?? '',
    color: course ? courseColor(course.color).hex : '#8fb39a',
    dueISO: next.due,
    path: `/app/courses/${next.courseId}?focus=${next.id}`,
  })
}
