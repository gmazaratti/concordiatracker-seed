import type { Attachment, Message } from '@/lib/social'
import type { Quote } from './MessageRow'

/** What a reply quotes, found in the loaded thread. A quote older than what
 *  is loaded still says it is a reply rather than silently dropping it. */
export function quoteOf(
  m: Message,
  rows: Message[],
  me: string | null,
  otherName: string,
): Quote | 'missing' | null {
  if (!m.reply_to) return null
  const q = rows.find((r) => r.id === m.reply_to)
  if (!q) return 'missing'
  return { who: q.sender === me ? 'You' : otherName, text: q.body.trim() || 'an attachment' }
}

/** One line naming an attachment, for the chip above the composer. */
export function describe(a: Attachment): string {
  if (a.kind === 'schedule') return `Schedule · ${a.name}`
  if (a.kind === 'course') return `Class · ${a.code}`
  if (a.kind === 'event') return `Event · ${a.title}`
  if (a.kind === 'record') return `Record · ${a.snapshot.credits} credits`
  if (a.kind === 'schedule_request') return 'Schedule request'
  return `Outline · ${a.code}`
}
