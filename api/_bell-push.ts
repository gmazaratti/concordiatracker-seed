/**
 * Push for the bell: club posts, new followers, feature-request updates.
 *
 * Those notifications are STORED rows (db/notifications.sql), written by
 * triggers at the moment the thing happens. This step turns a stored row into
 * a push, once: `claim_bell_pushes()` (db/native_push.sql) picks rows that are
 * unread, less than a day old, in a category the person has left on, and not
 * yet pushed, and stamps `pushed_at` in the same statement — so two overlapping
 * ticks of the 15-minute job can never send the same notification twice.
 *
 * Which categories exist and whether each one is on is decided in SQL
 * (`ct_push_category`, `user_profile.push_prefs`), not here, so the settings
 * screen and the sender read the same answer.
 */
import type { PushMessage, PushTarget } from './_push-send.js'

interface BellRow {
  id: string
  user_id: string
  kind: string
  title: string
  body: string | null
  link: string | null
}

export interface BellPushContext {
  supabaseUrl: string
  svc: Record<string, string>
  subsFor: (userId: string) => Promise<PushTarget[]>
  deliver: (subs: PushTarget[], payload: string) => Promise<number>
}

/** A notification link is an in-app path; anything else opens the bell. */
function safeUrl(link: string | null): string {
  if (link && link.startsWith('/') && !link.startsWith('//')) return link
  return '/app?activity=1'
}

export async function runBellPushes(ctx: BellPushContext, limit = 200): Promise<number> {
  const res = await fetch(`${ctx.supabaseUrl}/rest/v1/rpc/claim_bell_pushes`, {
    method: 'POST',
    headers: { ...ctx.svc, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: limit }),
  })
  // A missing function (migration not run yet) is a quiet zero, not a failure.
  if (!res.ok) return 0
  const rows = (await res.json()) as BellRow[]

  let sent = 0
  for (const n of rows) {
    const subs = await ctx.subsFor(n.user_id)
    if (subs.length === 0) continue
    const msg: PushMessage = {
      title: n.title,
      ...(n.body ? { body: n.body } : {}),
      url: safeUrl(n.link),
      // One per notification row, so two posts from the same club are two
      // notifications rather than one replacing the other.
      tag: `ct-bell-${n.id}`,
    }
    sent += await ctx.deliver(subs, JSON.stringify(msg))
  }
  return sent
}
