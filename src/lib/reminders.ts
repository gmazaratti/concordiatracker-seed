import { supabase } from './supabase'

/**
 * Client side of scheduled reminders. The UI sets/clears a reminder for an
 * assignment or event; the row (with a precomputed `fire_at` + denormalized
 * notification text) lands in `reminders` (per-user RLS), and the pg_cron-driven
 * /api/run-reminders endpoint actually delivers it.
 */

export type ReminderKind = 'assignment' | 'event'

/** Lead-time choices for the assignment reminder picker. 0 = off. */
export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'No reminder' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 10080, label: '1 week before' },
]

/** Default lead time for an event "Remind me" (1 day before). */
export const EVENT_LEAD_MINUTES = 1440

/** Short "in 1 hour / 1 day / 1 week" phrase for notification bodies. */
export function leadLabel(minutes: number): string {
  if (minutes >= 10080) return '1 week'
  if (minutes >= 1440) return '1 day'
  if (minutes >= 60) return '1 hour'
  return 'soon'
}

/** The saved lead time (minutes) for one assignment/event, or 0 if none. */
export async function getReminderOffset(kind: ReminderKind, refId: string): Promise<number> {
  const { data } = await supabase
    .from('reminders')
    .select('offset_minutes')
    .eq('kind', kind)
    .eq('ref_id', refId)
    .maybeSingle()
  return (data as { offset_minutes?: number } | null)?.offset_minutes ?? 0
}

/** Schedule (or reschedule) a reminder `offsetMinutes` before `dueISO`. */
export async function setReminder(opts: {
  kind: ReminderKind
  refId: string
  dueISO: string
  offsetMinutes: number
  title: string
  body: string
  url: string
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const fireAt = new Date(new Date(opts.dueISO).getTime() - opts.offsetMinutes * 60_000).toISOString()
  await supabase.from('reminders').upsert(
    {
      user_id: user.id,
      kind: opts.kind,
      ref_id: opts.refId,
      fire_at: fireAt,
      offset_minutes: opts.offsetMinutes,
      title: opts.title,
      body: opts.body,
      url: opts.url,
      sent_at: null, // re-arm if the due date moved
    },
    { onConflict: 'user_id,kind,ref_id' },
  )
}

export async function clearReminder(kind: ReminderKind, refId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('reminders').delete().eq('user_id', user.id).eq('kind', kind).eq('ref_id', refId)
}
