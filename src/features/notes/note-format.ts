import type { NoteMeta, NotesFilter } from './types'

/** "2:14 PM" today, "Tue" this week, "Sep 29" before that. */
export function noteDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

interface Group {
  label: string
  notes: NoteMeta[]
}

/**
 * Inside a class, notes are grouped by week of term (newest week first),
 * because that is how a course is lived: "what did we do in week 5". Pinned
 * notes sit above every group. Everywhere else the list is simply newest first.
 */
export function groupNotes(notes: NoteMeta[], filter: NotesFilter): Group[] {
  const pinned = notes.filter((n) => n.pinned)
  const rest = notes.filter((n) => !n.pinned)
  const groups: Group[] = pinned.length ? [{ label: 'Pinned', notes: pinned }] : []
  if (filter.kind !== 'course') {
    if (rest.length) groups.push({ label: pinned.length ? 'Notes' : '', notes: rest })
    return groups
  }
  const byWeek = new Map<number | null, NoteMeta[]>()
  for (const n of rest) byWeek.set(n.week, [...(byWeek.get(n.week) ?? []), n])
  const weeks = [...byWeek.keys()].sort((a, b) => (b ?? -1) - (a ?? -1))
  for (const w of weeks) {
    const list = byWeek.get(w)!.sort((a, b) =>
      (b.lectureDate ?? b.createdAt).localeCompare(a.lectureDate ?? a.createdAt),
    )
    groups.push({ label: w ? `Week ${w}` : 'No week', notes: list })
  }
  return groups
}
