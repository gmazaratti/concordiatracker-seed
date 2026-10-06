import type { NoteMeta } from './types'

/** "2:14 PM" today, "Tue" this week, "Sep 29" before that. */
export function noteDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** "Edited 5 minutes ago", for the info panel. */
export function ago(iso: string | null): string {
  if (!iso) return 'Never'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'Just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export interface NoteGroup {
  label: string
  notes: NoteMeta[]
}

/**
 * Pinned first, then — in a class — one group per week of term, newest week
 * first, because that is how a course is lived ("what did we do in week 5").
 * Anywhere else, newest first in one group.
 */
export function groupNotes(notes: NoteMeta[], byWeek: boolean): NoteGroup[] {
  const pinned = notes.filter((n) => n.pinned)
  const rest = notes.filter((n) => !n.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const groups: NoteGroup[] = pinned.length ? [{ label: 'Pinned', notes: pinned }] : []
  if (!byWeek) {
    if (rest.length) groups.push({ label: pinned.length ? 'Notes' : '', notes: rest })
    return groups
  }
  const weeks = new Map<number | null, NoteMeta[]>()
  for (const n of rest) weeks.set(n.week, [...(weeks.get(n.week) ?? []), n])
  for (const w of [...weeks.keys()].sort((a, b) => (b ?? -1) - (a ?? -1))) {
    groups.push({ label: w ? `Week ${w}` : 'No week', notes: weeks.get(w)! })
  }
  return groups
}
