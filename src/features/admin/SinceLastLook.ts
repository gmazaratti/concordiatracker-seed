/**
 * "What changed since I last looked at this."
 *
 * NOT a period-over-period comparison — that is a different question and the
 * Overview page already answers it. This one is personal and stateful: the
 * last value YOU saw, whenever that was, held in this browser.
 *
 * WHY localStorage AND NOT THE DATABASE. The baseline is "when I last had
 * this tab open", which is a fact about a person at a screen, not about the
 * account. Storing it server-side would make opening the dashboard on a phone
 * reset the deltas on the laptop, which is the opposite of useful. Every
 * access is wrapped because a private window throws on read.
 *
 * THE FIRST LOOK SHOWS NOTHING. With no baseline the honest delta is not
 * zero and not the whole value — it is "no idea yet", so the arrow is absent
 * until there is something real to compare against.
 */

const KEY = 'ct_admin_last_seen_stats'

type Snapshot = Record<string, number>

function read(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Snapshot) : {}
  } catch {
    return {}
  }
}

/**
 * The deltas, computed against the stored baseline, and the baseline updated
 * to the values just read.
 *
 * Returns null per key on a first look. Deliberately NOT a hook: it writes,
 * and a hook that writes during render is the thing this codebase keeps
 * getting bitten by.
 */
export function deltasSinceLastLook(current: Snapshot): Record<string, number | null> {
  const before = read()
  const out: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(current)) {
    const prev = before[k]
    out[k] = typeof prev === 'number' ? v - prev : null
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* a baseline that does not persist costs an arrow, not a number */
  }
  return out
}

/** Forget the baseline, so the next read starts clean. */
export function forgetLastLook(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}
