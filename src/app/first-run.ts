import { useEffect, useState } from 'react'

/**
 * One prompt at a time, in order.
 *
 * A new account used to arrive at Today and be met by FOUR things at once: the
 * getting-started checklist, two coachmarks, a "what's new" toast and an install
 * prompt. Individually each is reasonable; together they are a wall, and the
 * reliable response to a wall is to dismiss all of it without reading any of it.
 *
 * So they queue. A slot opens only when everything ahead of it is finished AND a
 * quiet gap has passed, which also means the ORDER can encode intent:
 *
 *   checklist   → what to do next. Earns the first slot; it is the only one that
 *                 is about the product's actual job.
 *   highlights  → where things are. Useless before there is anything to point at.
 *   updates     → what changed. Irrelevant to someone who has never seen the
 *                 old version, so it waits longest.
 *   install     → keep it. Asked LAST, because "add this to your home screen"
 *                 is a request, and requests come after value.
 *
 * State is per-device localStorage, not the database: this is about a session's
 * first few minutes, and a student who reinstalls deserves the tour again more
 * than they deserve consistency across devices.
 */
export type PromptId = 'checklist' | 'highlights' | 'updates' | 'install'

const ORDER: PromptId[] = ['checklist', 'highlights', 'updates', 'install']

/** How long after the PREVIOUS one clears before this one may appear. */
const GAP_MS: Record<PromptId, number> = {
  checklist: 4_000,
  highlights: 8_000,
  updates: 20_000,
  // Two minutes in. If they are still here after that, the app is worth keeping.
  install: 120_000,
}

const DONE_KEY = 'ct_prompts_done'
const START_KEY = 'ct_prompts_started'

function readDone(): Set<PromptId> {
  try {
    const raw = localStorage.getItem(DONE_KEY)
    return new Set(raw ? (JSON.parse(raw) as PromptId[]) : [])
  } catch {
    return new Set()
  }
}

function writeDone(done: Set<PromptId>): void {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]))
  } catch {
    /* private mode — the queue just restarts next session */
  }
}

/** When this device first reached the app. Seeded on the first read. */
function startedAt(): number {
  try {
    const raw = localStorage.getItem(START_KEY)
    if (raw) return Number(raw)
    const now = Date.now()
    localStorage.setItem(START_KEY, String(now))
    return now
  } catch {
    return Date.now()
  }
}

/** Mark a prompt finished — shown and dealt with, or not applicable. */
export function completePrompt(id: PromptId): void {
  const done = readDone()
  if (done.has(id)) return
  done.add(id)
  writeDone(done)
  window.dispatchEvent(new Event('ct-prompt-done'))
}

/**
 * May this prompt show yet?
 *
 * `eligible` lets a caller say "I have nothing to show anyway" — an install
 * prompt on a device that cannot install, say — so the queue is not held up
 * waiting for something that will never appear.
 */
export function usePromptSlot(id: PromptId, eligible = true): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // A prompt that can never apply on this device releases the queue for the
    // ones behind it rather than holding them forever.
    if (!eligible) {
      if (!readDone().has(id)) completePrompt(id)
      return
    }

    let alive = true
    let timer = 0

    // The gate is partly a clock, so it re-evaluates on a timer set to expire
    // exactly when the gap does — and again whenever something ahead finishes.
    // Everything reads the clock in here rather than during render, which would
    // make the component impure.
    const evaluate = () => {
      if (!alive) return
      const done = readDone()
      if (done.has(id)) {
        setOpen(false)
        return
      }
      const index = ORDER.indexOf(id)
      const blocked = ORDER.slice(0, index).some((prior) => !done.has(prior))
      const wait = GAP_MS[id] - (Date.now() - startedAt())
      if (!blocked && wait <= 0) {
        setOpen(true)
        return
      }
      setOpen(false)
      timer = window.setTimeout(evaluate, blocked ? 1500 : Math.max(250, wait))
    }

    // Deferred one tick: calling it inline would setState during the effect body.
    timer = window.setTimeout(evaluate, 0)
    const onDone = () => evaluate()
    window.addEventListener('ct-prompt-done', onDone)

    return () => {
      alive = false
      window.clearTimeout(timer)
      window.removeEventListener('ct-prompt-done', onDone)
    }
  }, [id, eligible])

  return open
}
