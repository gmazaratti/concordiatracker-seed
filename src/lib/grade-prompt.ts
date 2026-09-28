import { useSyncExternalStore } from 'react'

/**
 * "You just finished this; what did you get?" (features/courses/GradePrompt).
 *
 * A tiny store so any completion action (Today's check-off, a Moodle item's
 * tick, the course detail's done toggle or status dropdown) can ask for a grade
 * without knowing where the prompt lives.
 *
 * A QUEUE, NOT A SLOT. Ticking off three things in a row used to replace the
 * question each time, so only the last one was ever asked about. Each
 * completion now joins the back of the line (once: a second tick of the same
 * item does not ask twice) and the prompt works through them in order.
 *
 * Two kinds of thing can be finished: an ASSESSMENT (it has a grade field) and
 * a synced Moodle TASK (it does not; a grade entered there becomes an
 * assessment in the matching course). The key says which, so one line holds
 * both in the order they were ticked.
 */
export type PromptKey = `a:${string}` | `t:${string}`

interface Snapshot {
  queue: readonly PromptKey[]
  /** The item whose grade was just saved: kept on screen for its Undo even
   *  though it now HAS a grade, which would otherwise make it drop out. */
  saved: PromptKey | null
}

let snap: Snapshot = { queue: [], saved: null }
const subs = new Set<() => void>()
const set = (next: Partial<Snapshot>) => {
  snap = { ...snap, ...next }
  subs.forEach((f) => f())
}

function push(key: PromptKey) {
  if (snap.queue.includes(key)) return
  set({ queue: [...snap.queue, key] })
}

export function askForGrade(assessmentId: string): void {
  push(`a:${assessmentId}`)
}

/** A synced Moodle item was ticked off. */
export function askForTaskGrade(taskId: string): void {
  push(`t:${taskId}`)
}

/** Take one question out of the line (answered, skipped, undone or timed out). */
export function dismissGradePrompt(key: PromptKey): void {
  set({
    queue: snap.queue.filter((x) => x !== key),
    saved: snap.saved === key ? null : snap.saved,
  })
}

export function markGradeSaved(key: PromptKey | null): void {
  set({ saved: key })
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
