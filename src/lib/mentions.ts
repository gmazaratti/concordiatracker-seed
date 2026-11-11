/**
 * @mentions in messages: a person (@handle) or a place in the app (@Planner,
 * @Feed). Pure, so the parsing is Node-checked.
 *
 * A person is linked to their profile; a channel to that screen. Matching is
 * on the literal text, so nothing about a message changes when it is stored:
 * an old message that happened to contain "@feed" simply starts linking.
 */
export interface Channel {
  name: string
  path: string
  hint: string
}

export const CHANNELS: Channel[] = [
  { name: 'Today', path: '/app', hint: 'What is due' },
  { name: 'Courses', path: '/app/courses', hint: 'Your classes' },
  { name: 'Calendar', path: '/app/calendar', hint: 'Month and week' },
  { name: 'Planner', path: '/app/planner', hint: 'Plan next term' },
  { name: 'Schedule', path: '/app/planner?tab=schedule', hint: 'Schedule builder' },
  { name: 'Radar', path: '/app/planner?tab=radar', hint: 'What the term will throw at you' },
  { name: 'Resources', path: '/app/planner?tab=resources', hint: 'Advisors and campus help' },
  { name: 'Notes', path: '/app/notes', hint: 'Your notes' },
  { name: 'Feed', path: '/app/community', hint: 'Clubs and posts' },
  { name: 'Events', path: '/app/community?c=events', hint: 'What is on campus' },
  { name: 'Messages', path: '/app/community?c=messages', hint: 'Your conversations' },
]

const BY_NAME = new Map(CHANNELS.map((c) => [c.name.toLowerCase(), c]))

export type Segment = { text: string } | { mention: string; href: string; kind: 'person' | 'channel' }

/** Handles are 3-20 of [a-z0-9_]; channels are matched case-insensitively. */
const TOKEN = /(^|[^\w@])@([A-Za-z0-9_]{2,20})\b/g

/** Split a message into plain text and linked mentions. */
export function splitMentions(body: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of body.matchAll(TOKEN)) {
    const start = (m.index ?? 0) + m[1].length
    const word = m[2]
    const channel = BY_NAME.get(word.toLowerCase())
    const person = /^[a-z0-9_]{3,20}$/.test(word)
    if (!channel && !person) continue
    if (start > last) out.push({ text: body.slice(last, start) })
    out.push(
      channel
        ? { mention: `@${channel.name}`, href: channel.path, kind: 'channel' }
        : { mention: `@${word}`, href: `/@${word}`, kind: 'person' },
    )
    last = start + 1 + word.length
  }
  if (last < body.length) out.push({ text: body.slice(last) })
  return out
}

/** The "@word" being typed at the caret, or null. */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const m = /(^|\s)@([A-Za-z0-9_]{0,20})$/.exec(before)
  if (!m) return null
  return { start: caret - m[2].length - 1, query: m[2] }
}

/** Replace the "@word" at the caret with the chosen mention and a space. */
export function insertMention(text: string, caret: number, mention: string): { text: string; caret: number } {
  const at = mentionAt(text, caret)
  if (!at) return { text, caret }
  const next = `${text.slice(0, at.start)}${mention} ${text.slice(caret)}`
  return { text: next, caret: at.start + mention.length + 1 }
}

export function matchChannels(query: string): Channel[] {
  const q = query.toLowerCase()
  return CHANNELS.filter((c) => c.name.toLowerCase().startsWith(q))
}
