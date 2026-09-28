import type { Assessment, Course } from '@/data/types'
import { courseColor } from './course-color'
import { isOpen } from './status'
import { parseMeetingTimes } from '@/features/today/widgets/meeting-times'

/**
 * What the Home Screen widgets show, computed here and handed to iOS.
 *
 * The widgets run in their own process and cannot read the app's data, so the
 * app writes this JSON into the shared App Group (WidgetBridgePlugin.swift)
 * and the widget extension decodes it (SharedSnapshot.swift). The two shapes
 * must agree field for field.
 *
 * Everything that needs judgement is done HERE, where the app's own rules
 * live: which assessments are still open, what a course's colour is, how a
 * meeting-time string turns into real dates. The widget only picks "the next
 * one" relative to the moment it renders.
 *
 * Pure: `now` is a parameter, so the output depends on nothing but its inputs.
 */
export interface WidgetDeadline {
  id: string
  title: string
  course: string
  color: string
  due: string
  kind: string
}

export interface WidgetClass {
  code: string
  title: string
  color: string
  start: string
  end: string
  location: string | null
}

export interface WidgetSnapshotData {
  savedAt: string
  deadlines: WidgetDeadline[]
  classes: WidgetClass[]
}

const MAX_DEADLINES = 20
const DEADLINE_WINDOW_DAYS = 60
const CLASS_WINDOW_DAYS = 7
const MAX_CLASSES = 30

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function buildWidgetSnapshot(
  courses: Course[],
  assessments: Assessment[],
  now: Date,
): WidgetSnapshotData {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const horizon = now.getTime() + DEADLINE_WINDOW_DAYS * 86_400_000

  const deadlines: WidgetDeadline[] = assessments
    .filter((a) => isOpen(a.status) && !!a.due && !a.noDate)
    .filter((a) => {
      const t = new Date(a.due as string).getTime()
      return t >= now.getTime() && t <= horizon
    })
    .sort((a, b) => new Date(a.due as string).getTime() - new Date(b.due as string).getTime())
    .slice(0, MAX_DEADLINES)
    .map((a) => {
      const course = byId.get(a.courseId)
      return {
        id: a.id,
        title: a.title || 'Untitled',
        course: course?.code || 'Task',
        color: course ? courseColor(course.color).hex : '#8fb39a',
        due: new Date(a.due as string).toISOString(),
        kind: a.kind,
      }
    })

  const classes: WidgetClass[] = []
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  for (const course of courses) {
    for (const slot of parseMeetingTimes(course.meetingTimes)) {
      const endMin = minutesOf(slot.end)
      if (endMin === null) continue
      for (let k = 0; k < CLASS_WINDOW_DAYS; k++) {
        const day = new Date(today)
        day.setDate(today.getDate() + k)
        if (day.getDay() !== slot.day) continue
        const start = new Date(day)
        start.setMinutes(slot.startMinutes)
        const end = new Date(day)
        end.setMinutes(endMin)
        if (end.getTime() <= now.getTime()) continue
        classes.push({
          code: course.code,
          title: course.title,
          color: courseColor(course.color).hex,
          start: start.toISOString(),
          end: end.toISOString(),
          location: course.location?.trim() || null,
        })
      }
    }
  }
  classes.sort((a, b) => a.start.localeCompare(b.start))

  return { savedAt: now.toISOString(), deadlines, classes: classes.slice(0, MAX_CLASSES) }
}
