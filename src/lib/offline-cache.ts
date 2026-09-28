import type { Assessment, CalendarTask, Course } from '@/data/types'

/**
 * The last copy of someone's term that loaded, kept on this device so the app
 * has something true to show with no network (airplane mode, a dead zone in
 * the metro, a campus Wi-Fi login page).
 *
 * WHAT IS KEPT: courses, assessments, tasks and the profile row, exactly as
 * they last came back from the database, per account. Nothing is written to it
 * while offline, so it never records a change that did not reach the server.
 *
 * WHAT IT IS NOT: a sync engine. Edits made offline are not queued; the screen
 * says so while it is showing saved data. Queued writes are a real feature
 * with real conflict rules, and half of one would lose grades.
 *
 * Cleared on sign-out (see AuthProvider), so a shared phone does not keep the
 * last person's grades.
 */
const SNAPSHOT = (uid: string) => `ct_offline_${uid}`
const PROFILE = (uid: string) => `ct_offline_profile_${uid}`
const VERSION = 1

export interface Snapshot {
  v: number
  savedAt: string
  courses: Course[]
  assessments: Assessment[]
  tasks: CalendarTask[]
}

export function saveSnapshot(
  uid: string,
  data: { courses: Course[]; assessments: Assessment[]; tasks: CalendarTask[] },
): void {
  try {
    const snap: Snapshot = { v: VERSION, savedAt: new Date().toISOString(), ...data }
    localStorage.setItem(SNAPSHOT(uid), JSON.stringify(snap))
  } catch {
    /* storage full or blocked: the app still works online */
  }
}

export function readSnapshot(uid: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT(uid))
    if (!raw) return null
    const snap = JSON.parse(raw) as Snapshot
    if (snap?.v !== VERSION || !Array.isArray(snap.courses) || !Array.isArray(snap.assessments)) return null
    return { ...snap, tasks: Array.isArray(snap.tasks) ? snap.tasks : [] }
  } catch {
    return null
  }
}

export function saveProfileRow(uid: string, row: unknown): void {
  try {
    localStorage.setItem(PROFILE(uid), JSON.stringify(row))
  } catch {
    /* as above */
  }
}

export function readProfileRow<T>(uid: string): T | null {
  try {
    const raw = localStorage.getItem(PROFILE(uid))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Sign-out: forget every account's saved copy on this device. */
export function clearOfflineCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith('ct_offline_')) localStorage.removeItem(k)
    }
  } catch {
    /* nothing stored, or storage blocked */
  }
}

/**
 * Whether a Supabase error means "could not reach the server" rather than
 * "the server said no". Only the first may fall back to saved data: a refusal
 * (RLS, a missing column) must never be papered over with an old copy.
 */
export function isNetworkError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return /failed to fetch|networkerror|load failed|network request failed|internet connection/i.test(
    err.message ?? '',
  )
}
