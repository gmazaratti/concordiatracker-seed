/** Per-tab memory for the Getting started card: whether it is open, and the
 *  step the student last tapped. sessionStorage, so a new visit starts fresh. */
const OPEN_KEY = 'ct_checklist_open'
const ACTIVE_KEY = 'ct_checklist_active'

export function readOpen(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}
export function writeOpen(v: boolean) {
  try {
    sessionStorage.setItem(OPEN_KEY, v ? '1' : '0')
  } catch {
    /* private mode: it just forgets */
  }
}
export function readActive(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}
export function writeActive(id: string | null) {
  try {
    if (id) sessionStorage.setItem(ACTIVE_KEY, id)
    else sessionStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* private mode */
  }
}
