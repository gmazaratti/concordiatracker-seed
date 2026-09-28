import { useSyncExternalStore } from 'react'

/**
 * "You just finished this; what did you get?" (features/courses/GradePrompt).
 *
 * A tiny store so any completion action (Today's check-off, the course
 * detail's done toggle or status dropdown) can ask for a grade without
 * knowing where the prompt lives.
 *
 * A QUEUE, NOT A SLOT. Ticking off three things in a row used to replace the
 * question each time, so only the last one was ever asked about. Each
 * completion now joins the back of the line (once: a second tick of the same
 * item does not ask twice) and the prompt works through them in order.
 */
interface Snapshot {
  queue: readonly string[]
  /** The item whose grade was just saved: kept on screen for its Undo even
   *  though it now HAS a grade, which would otherwise make it drop out. */
  saved: string | null
}

let snap: Snapshot = { queue: [], saved: null }
const subs = new Set<() => void>()
const set = (next: Partial<Snapshot>) => {
  snap = { ...snap, ...next }
  subs.forEach((f) => f())
}

export function askForGrade(assessmentId: string): void {
  if (snap.queue.includes(assessmentId)) return
  set({ queue: [...snap.queue, assessmentId] })
}

/** Take one question out of the line (answered, skipped or timed out). */
export function dismissGradePrompt(assessmentId: string): void {
  set({
    queue: snap.queue.filter((x) => x !== assessmentId),
    saved: snap.saved === assessmentId ? null : snap.saved,
  })
}

export function markGradeSaved(assessmentId: string | null): void {
  set({ saved: assessmentId })
}

export function useGradePrompts(): Snapshot {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => snap,
    () => snap,
  )
}
