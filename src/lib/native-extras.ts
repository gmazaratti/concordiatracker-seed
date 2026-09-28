import { Capacitor, registerPlugin } from '@capacitor/core'
import { supabase } from './supabase'

/**
 * The iOS-only abilities a web view cannot reach on its own, each backed by a
 * small Swift plugin in ios/App/App (registered in MainViewController):
 *
 *   CalendarBridge  → EventKit: write one assignment into Apple Calendar.
 *   SpotlightBridge → Core Spotlight: make assignments findable from Home
 *                     Screen search; a tapped result opens the assignment.
 *   DeadlineActivity → ActivityKit: the "next assignment due" Live Activity on
 *                     the Lock Screen and in the Dynamic Island.
 *
 * Every call is a no-op outside the App Store app, and every one resolves
 * rather than throws when the binary predates the plugin, so an older build
 * simply lacks the feature instead of breaking the screen that asked.
 */

interface CalendarBridgePlugin {
  addEvent(o: {
    title: string
    notes: string
    url: string
    startISO: string
    endISO: string
  }): Promise<{ status: 'saved' | 'denied' | 'error'; message?: string }>
}

export interface SpotlightItem {
  id: string
  title: string
  subtitle: string
  /** In-app path the result opens, e.g. /app/courses/<id>?focus=<id>. */
  path: string
  dueISO: string | null
}

interface SpotlightBridgePlugin {
  replaceAll(o: { items: SpotlightItem[] }): Promise<void>
  clear(): Promise<void>
}

export interface DeadlineActivityState {
  assessmentId: string
  title: string
  course: string
  /** A hex like #3b82f6, for the island's keyline and accents. */
  color: string
  dueISO: string
  path: string
  /**
   * When the Live Activity should appear, if that is later than now. iOS 26
   * can schedule it so it starts with the app closed; earlier systems ignore
   * a future start and wait for the app to be opened inside the window.
   */
  startISO?: string
}

interface DeadlineActivityPlugin {
  /** Starts, or updates the one already running, for this assessment. */
  show(o: DeadlineActivityState): Promise<{ started: boolean; reason?: string }>
  /** Ends every running one with a final "done" or "overdue" card. */
  end(o: { outcome: 'done' | 'overdue' | 'none' }): Promise<void>
  /** The ids currently shown (so the app does not restart one needlessly). */
  current(): Promise<{ assessmentId?: string }>
  /** iOS 17.2+: the token the server uses to start one with the app closed. */
  pushToStartToken(): Promise<{ token?: string }>
  addListener(event: 'pushToStartToken', fn: (e: { token: string }) => void): Promise<{ remove: () => void }>
}

interface SiriBridgePlugin {
  donateAddAssignment(o: { title: string }): Promise<void>
}

const CalendarBridge = registerPlugin<CalendarBridgePlugin>('CalendarBridge')
const SpotlightBridge = registerPlugin<SpotlightBridgePlugin>('SpotlightBridge')
const DeadlineActivity = registerPlugin<DeadlineActivityPlugin>('DeadlineActivity')
const SiriBridge = registerPlugin<SiriBridgePlugin>('SiriBridge')

export const nativeIOS = (): boolean => {
  try {
    return Capacitor.getPlatform() === 'ios'
  } catch {
    return false
  }
}

export async function addToAppleCalendar(o: {
  title: string
  course: string
  dueISO: string
  path: string
  notes?: string
}): Promise<'saved' | 'denied' | 'error' | 'unavailable'> {
  if (!nativeIOS()) return 'unavailable'
  const end = new Date(o.dueISO)
  // A deadline is a moment, not a meeting: a 30-minute block ending at the
  // due time reads as "have it in by then" in Calendar's day view.
  const start = new Date(end.getTime() - 30 * 60_000)
  const link = `https://concordiatracker.com${o.path}`
  try {
    const r = await CalendarBridge.addEvent({
      title: o.course ? `${o.course} · ${o.title}` : o.title,
      notes: [o.notes?.trim(), `Open in ConcordiaTracker: ${link}`].filter(Boolean).join('\n\n'),
      url: link,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    })
    return r.status
  } catch {
    return 'unavailable'
  }
}

export async function spotlightReplaceAll(items: SpotlightItem[]): Promise<void> {
  if (!nativeIOS()) return
  try {
    await SpotlightBridge.replaceAll({ items })
  } catch {
    /* an older binary without the plugin */
  }
}

export async function spotlightClear(): Promise<void> {
  if (!nativeIOS()) return
  try {
    await SpotlightBridge.clear()
  } catch {
    /* nothing to clear */
  }
}

export async function showDeadlineActivity(s: DeadlineActivityState): Promise<boolean> {
  if (!nativeIOS()) return false
  try {
    return (await DeadlineActivity.show(s)).started
  } catch {
    return false
  }
}

export async function endDeadlineActivity(outcome: 'done' | 'overdue' | 'none'): Promise<void> {
  if (!nativeIOS()) return
  try {
    await DeadlineActivity.end({ outcome })
  } catch {
    /* nothing running */
  }
}

export async function currentDeadlineActivity(): Promise<string | null> {
  if (!nativeIOS()) return null
  try {
    return (await DeadlineActivity.current()).assessmentId ?? null
  } catch {
    return null
  }
}

let registeredToken: string | null = null

/**
 * Hand this phone's push-to-start token to the server (db/live_activity.sql),
 * now and whenever iOS rotates it, so the cron can start the Live Activity
 * with the app closed. Once per signed-in session.
 */
export async function registerLiveActivityToken(): Promise<void> {
  if (!nativeIOS()) return
  const save = async (token: string) => {
    if (!token || token === registeredToken) return
    const { error } = await supabase.rpc('register_live_activity_token', { p_token: token })
    if (!error) registeredToken = token
  }
  try {
    await DeadlineActivity.addListener('pushToStartToken', (e) => void save(e.token))
    const now = await DeadlineActivity.pushToStartToken()
    if (now.token) await save(now.token)
  } catch {
    /* before iOS 17.2, or an older binary: the app starts it itself when open */
  }
}

/** Sign-out: this phone stops receiving the last person's Live Activities. */
export async function unregisterLiveActivityToken(): Promise<void> {
  if (!registeredToken) return
  const token = registeredToken
  registeredToken = null
  await supabase.rpc('unregister_live_activity_token', { p_token: token })
}

/** So Siri learns to suggest "Add an assignment in ConcordiaTracker". */
export function donateAddAssignment(title: string): void {
  if (!nativeIOS()) return
  void SiriBridge.donateAddAssignment({ title }).catch(() => {})
}
