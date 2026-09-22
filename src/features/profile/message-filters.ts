/**
 * Filtering the conversation list.
 *
 * PURE, and separate from the sheet that drives it, so the rules can be tested
 * in Node and so the same predicate decides what the list shows AND what the
 * "nothing matches" line says. Two copies of "is this unread" is how a filter
 * ends up hiding a row it claims to be showing.
 *
 * FILTERS COMBINE WITH AND. Unread + Organizations means unread messages from
 * clubs, not "either". That is what every messenger does and it is the only
 * reading that makes stacking two of them useful.
 */

export type MessageFilterId = 'unread' | 'unanswered' | 'story' | 'verified' | 'orgs'

/**
 * What `StoryViewer` puts in front of a story reply before it sends it. It is
 * a real prefix on a real message, not a flag we infer — which is why this
 * filter can exist at all without a column for it.
 */
export const STORY_REPLY_PREFIX = 'Replying to your story:'

export const MESSAGE_FILTERS: { id: MessageFilterId; label: string; hint: string }[] = [
  { id: 'unread', label: 'Unread', hint: 'Conversations with messages you have not opened' },
  { id: 'unanswered', label: 'Unanswered', hint: 'They wrote last and you have not replied' },
  { id: 'story', label: 'Story replies', hint: 'The latest message answers one of your stories' },
  { id: 'verified', label: 'Verified profiles', hint: 'Accounts carrying a verification seal' },
  { id: 'orgs', label: 'Organizations', hint: 'Clubs and associations, not people' },
]

/**
 * The only facts a filter is allowed to read.
 *
 * A row in the list can be a person you have never written to, so every
 * conversation field is optional — and absent is NOT the same as false. A
 * person with no thread has no last message, so "unanswered" cannot be true
 * of them, and saying so explicitly keeps that out of the call sites.
 */
export interface FilterableRow {
  kind: 'user' | 'org'
  unread: number
  /** Undefined when nothing has been said yet. */
  lastFromMe?: boolean
  lastBody?: string | null
  verified: boolean
}

export function isStoryReply(body: string | null | undefined): boolean {
  return (body ?? '').trimStart().startsWith(STORY_REPLY_PREFIX)
}

function matchesOne(row: FilterableRow, id: MessageFilterId): boolean {
  switch (id) {
    case 'unread':
      return row.unread > 0
    case 'unanswered':
      // Never said anything is not the same as said something you ignored.
      return row.lastFromMe === false
    case 'story':
      return isStoryReply(row.lastBody)
    case 'verified':
      return row.verified
    case 'orgs':
      return row.kind === 'org'
  }
}

export function matchesFilters(row: FilterableRow, active: Iterable<MessageFilterId>): boolean {
  for (const id of active) if (!matchesOne(row, id)) return false
  return true
}

/** "Unread and Organizations" — for the line that explains an empty list. */
export function describeFilters(active: Iterable<MessageFilterId>): string {
  const names = [...active]
    .map((id) => MESSAGE_FILTERS.find((f) => f.id === id)?.label)
    .filter((s): s is string => !!s)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
