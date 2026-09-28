import { LocalNotifications } from '@capacitor/local-notifications'
import type { Assessment, CalendarTask, Course } from '@/data/types'
import { Capacitor } from '@capacitor/core'
import { isOpen } from './status'
import { hash32, mergeOffsets, reminderCopy, type ReminderTone } from './reminder-copy'
import { coveredTaskIds, pairMoodleToAssessments, stripMoodleTitle } from './moodle-match'

/**
 * Assignment reminders on the phone, as LOCAL notifications.
 *
 * Scheduled on the device rather than pushed, so they fire on a plane, in a
 * basement lecture hall, or when our server is having a bad night. The server
 * sends the same reminders to BROWSERS only (db/assignment_reminders.sql), so
 * nothing arrives twice.
 *
 * iOS keeps at most 64 pending local notifications per app, so the soonest 60
 * are scheduled and the rest wait: the list is rebuilt whenever assignments,
 * settings or the app's foreground state change, so the window slides forward
 * on its own.
 */

/** Room under iOS's 64 for anything else the app schedules. */
const MAX_SCHEDULED = 60
const KIND = 'due'
// Not native.ts's isNative: native.ts imports this file (for the tap listener).
const isNative = () => Capacitor.isNativePlatform()

export interface ReminderPlan {
  id: number
  at: Date
  title: string
  body: string
  path: string
}

export interface ReminderInput {
  assessments: Assessment[]
  courses: Course[]
  tasks: CalendarTask[]
  enabled: boolean
  defaults: number[]
  tone: ReminderTone
  now?: number
}

/** PURE: every reminder that should be pending right now, soonest first. */
export function planReminders(input: ReminderInput): ReminderPlan[] {
  if (!input.enabled) return []
  const now = input.now ?? Date.now()
  const code = new Map(input.courses.map((c) => [c.id, c.code]))
  const out: ReminderPlan[] = []

  const push = (key: string, dueISO: string, offsets: number[], title: string, course: string, path: string) => {
    const due = Date.parse(dueISO)
    if (!Number.isFinite(due) || due <= now) return
    for (const off of offsets) {
      const at = due - off * 60_000
      if (at <= now + 5_000) continue
      const words = reminderCopy({ tone: input.tone, title, course, offsetMinutes: off, seed: key })
      out.push({
        // Stable per (item, lead time, due): rescheduling the same reminder
        // replaces it rather than stacking a copy.
        id: hash32(`${key}:${off}:${dueISO}`) & 0x7fffffff,
        at: new Date(at),
        title: words.title,
        body: words.body,
        path,
      })
    }
  }

  for (const a of input.assessments) {
    if (!a.due || !isOpen(a.status)) continue
    push(
      a.id,
      a.due,
      mergeOffsets(input.defaults, a.reminders),
      a.title,
      code.get(a.courseId) ?? '',
      `/app/courses/${a.courseId}?focus=${a.id}`,
    )
  }
  // Synced Moodle deadlines no syllabus lists (the paired ones are the
  // assessment above, reminded once).
  const covered = coveredTaskIds(pairMoodleToAssessments(input.tasks, input.assessments, input.courses))
  for (const t of input.tasks) {
    if (t.source !== 'moodle' || t.done || covered.has(t.id)) continue
    push(t.id, t.due, mergeOffsets(input.defaults, []), stripMoodleTitle(t.title) || t.title, '', '/app')
  }

  return out.sort((x, y) => x.at.getTime() - y.at.getTime()).slice(0, MAX_SCHEDULED)
}

let lastSignature = ''

/** Replace every pending reminder with `plan`. Skips the work when nothing changed. */
export async function applyReminderPlan(plan: ReminderPlan[]): Promise<void> {
  if (!isNative()) return
  const signature = plan.map((p) => `${p.id}@${p.at.getTime()}:${p.body}`).join('|')
  if (signature === lastSignature) return
  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => (n.extra as { kind?: string } | undefined)?.kind === KIND)
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
    if (plan.length) {
      await LocalNotifications.schedule({
        notifications: plan.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          schedule: { at: p.at, allowWhileIdle: true },
          extra: { kind: KIND, path: p.path },
        })),
      })
    }
    lastSignature = signature
  } catch {
    /* an older binary without the plugin, or refused: the web push still covers browsers */
  }
}

/** Sign-out: nobody else's deadlines should ring on this phone. */
export async function cancelLocalReminders(): Promise<void> {
  lastSignature = ''
  if (!isNative()) return
  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => (n.extra as { kind?: string } | undefined)?.kind === KIND)
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
  } catch {
    /* nothing scheduled */
  }
}

/** Asked in context (turning reminders on, or adding one), never at launch. */
export async function requestReminderPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!isNative()) return 'unavailable'
  try {
    const now = await LocalNotifications.checkPermissions()
    if (now.display === 'granted') return 'granted'
    const asked = await LocalNotifications.requestPermissions()
    return asked.display === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'unavailable'
  }
}

export async function reminderPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
  if (!isNative()) return 'unavailable'
  try {
    const p = await LocalNotifications.checkPermissions()
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'unavailable'
  }
}

/** Tapping a reminder opens the assignment. Called once from initNative. */
export function listenForReminderTaps(navigate: (path: string) => void): void {
  if (!isNative()) return
  void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    const path = (notification.extra as { path?: string } | undefined)?.path
    if (path && path.startsWith('/')) navigate(path)
  }).catch(() => {})
}
