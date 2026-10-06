import { searchPeople } from '@/features/community/profile-follows'
import type { NotePerson } from '../sharing-api'

/** One line in the "@" menu: a date to drop in, or a person to mention. */
export type MentionItem =
  | { kind: 'date'; id: string; label: string; hint: string; iso: string | null }
  | { kind: 'person'; id: string; userId: string | null; handle: string | null; label: string; avatar: string | null; hint: string; access: boolean }

function at(daysAhead: number, hour: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function nextMonday(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

const DATES = (): MentionItem[] => [
  { kind: 'date', id: 'today', label: 'Today', hint: 'Date', iso: at(0, 17) },
  { kind: 'date', id: 'tomorrow', label: 'Tomorrow', hint: 'Date', iso: at(1, 9) },
  { kind: 'date', id: 'nextweek', label: 'Next week', hint: 'Monday', iso: nextMonday() },
  { kind: 'date', id: 'pick', label: 'Pick a date or time…', hint: '', iso: null },
]

/**
 * What "@" offers for what was typed after it: dates first when the words
 * match, then the people this note is shared with (they can be notified), then
 * anyone else on ConcordiaTracker with a public profile.
 */
export async function mentionItems(query: string, people: NotePerson[], myId: string | null): Promise<MentionItem[]> {
  const q = query.trim().toLowerCase()
  const dates = DATES().filter((d) => !q || d.label.toLowerCase().startsWith(q) || ('date'.startsWith(q) && q.length > 1) || ('time'.startsWith(q) && q.length > 1))
  const here: MentionItem[] = people
    .filter((p) => p.userId !== myId)
    .filter((p) => !q || (p.name ?? '').toLowerCase().includes(q) || (p.handle ?? '').toLowerCase().startsWith(q))
    .slice(0, 6)
    .map((p) => ({
      kind: 'person', id: `u:${p.userId}`, userId: p.userId, handle: p.handle, label: p.name || p.handle || 'Someone',
      avatar: p.avatarUrl, hint: p.role === 'owner' ? 'Owner' : p.role === 'editor' ? 'Can edit' : 'Can view', access: true,
    }))
  let others: MentionItem[] = []
  if (q.length >= 2) {
    const seen = new Set(here.map((h) => (h.kind === 'person' ? h.handle : null)))
    others = (await searchPeople(q, 6))
      .filter((p) => !seen.has(p.handle))
      .map((p) => ({
        kind: 'person', id: `h:${p.handle}`, userId: null, handle: p.handle, label: p.name || p.handle,
        avatar: p.avatar_url, hint: 'No access to this note', access: false,
      }))
  }
  return [...dates, ...here, ...others].slice(0, 12)
}
