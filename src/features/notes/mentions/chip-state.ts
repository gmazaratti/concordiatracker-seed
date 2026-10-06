/**
 * Set just before THIS screen inserts a date chip from "Pick a date…", so that
 * chip opens its picker at once. Local, like the drawing flag: in the document
 * it would open the picker for everyone else in the note too.
 */
export const dateChipOpen = { next: false }

export function takeDateChipOpen(): boolean {
  const v = dateChipOpen.next
  dateChipOpen.next = false
  return v
}

/** Mark the next date chip this screen inserts to open its picker. */
export function armDateChipOpen() {
  dateChipOpen.next = true
}
