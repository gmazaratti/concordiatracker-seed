/**
 * /api/v1/support/* — the assistant's side of the support desk.
 *
 * THIS FILE IS A TRANSLATOR, NOT A RULE-KEEPER. Which threads may be replied
 * to is decided in the database (see db/support_api.sql), because an HTTP
 * handler can be routed around by the next caller, a retry, or a script
 * written in a hurry — and what is being protected is a real customer being
 * answered twice, or answered by a machine right after they asked for a
 * person. So this maps a refusal onto a 409 and its reason; it never decides
 * one.
 *
 * APPROVAL MODE IS NOT ENFORCED HERE EITHER, deliberately. Whether a draft is
 * shown to Alex before it is sent is a policy on the assistant's side, so
 * turning auto-send on later changes nothing in this file — which is the
 * point of keeping the API ignorant of it.
 */
import { iso, rpcRaw } from './_v1-auth.js'
import { article, articles, searchHits } from './_v1-kb.js'
import { notifyTicketReply } from './_ticket-email.js'

interface Json {
  [k: string]: unknown
}

/** A PostgREST error, which is how a raise in the database arrives here. */
interface PgError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

/**
 * Call a support RPC and separate a REFUSAL from a FAILURE.
 *
 * The database raises with a stable token in `detail` precisely so this does
 * not have to match on sentences. A refusal is a 409 the caller can branch
 * on; anything else is ours to own as a 500.
 */
async function call<T>(
  fn: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; status: number; reason: string; message: string }> {
  const res = await rpcRaw(fn, body)
  if (res.ok) return { ok: true, data: res.data as T }

  const err = (res.error ?? {}) as PgError
  const reason = err.details ?? ''

  // MAP THE SQLSTATE, NOT A LIST OF REASONS. This used to be a hand-written
  // allowlist of every `detail` the functions raise, and the first time the
  // database learned three new ones — crisis_hold, money_hold and
  // resolve_is_human_only — they fell through to a 500. A guard that answers
  // "server error" is a guard the caller retries.
  //
  // The class is already encoded where it is raised, so read that instead and
  // a reason added in SQL needs no change here:
  //   P0002  the thing does not exist          → 404
  //   22023  the caller sent something invalid → 400
  //   P0001  the caller may not do this        → 409
  if (err.code === 'P0002') {
    return { ok: false, status: 404, reason: reason || 'not_found', message: err.message ?? 'No thread with that id.' }
  }
  if (err.code === '22023') {
    return { ok: false, status: 400, reason: reason || 'bad_request', message: err.message ?? 'Bad request.' }
  }
  if (err.code === 'P0001') {
    return {
      ok: false,
      status: 409,
      reason: reason || 'conflict',
      message: err.message ?? 'That thread is not open to you.',
    }
  }

  // A MISSING FUNCTION IS A DEPLOYMENT FACT, NOT A SERVER ERROR, and saying
  // so is the difference between five minutes and an afternoon. PostgREST
  // answers PGRST202 both for a function that does not exist and for one
  // called with the wrong argument names, so the message names both.
  if (err.code === 'PGRST202') {
    return {
      ok: false,
      status: 503,
      reason: 'migration_missing',
      message:
        `The database does not have ${fn} in the shape this endpoint calls it. ` +
        'Run db/support_api.sql and db/support_api_v2.sql, newest last.',
    }
  }

  return {
    ok: false,
    status: 500,
    reason: 'error',
    message: err.message ?? 'The database refused that.',
  }
}

const TYPES = new Set(['ticket', 'diagnostic'])
const STATUSES = new Set(['open', 'ai_handling', 'human_takeover', 'resolved'])

export async function listThreads(q: Json): Promise<{ status: number; json: Json }> {
  const type = String(q.type ?? '').trim()
  const status = String(q.status ?? '').trim()
  if (type && !TYPES.has(type)) {
    return { status: 400, json: { error: 'type must be ticket or diagnostic.' } }
  }
  if (status && !STATUSES.has(status)) {
    return {
      status: 400,
      json: { error: `status must be one of: ${[...STATUSES].join(', ')}.` },
    }
  }

  const since = String(q.since ?? '').trim()
  if (since && Number.isNaN(Date.parse(since))) {
    return { status: 400, json: { error: 'since must be an ISO-8601 timestamp.' } }
  }

  // `limit` is the documented name; `per_page` is accepted because the
  // first version of this endpoint used it and something may already.
  const limit = Math.max(1, Math.min(Number(q.limit ?? q.per_page) || 50, 200))
  const cursor = String(q.cursor ?? '').trim()

  // Tri-state on purpose: absent means "either", not "false".
  let needsHuman: boolean | null = null
  if (q.needs_human != null && q.needs_human !== '') {
    const raw = String(q.needs_human).toLowerCase()
    if (raw !== 'true' && raw !== 'false') {
      return { status: 400, json: { error: 'needs_human must be true or false.' } }
    }
    needsHuman = raw === 'true'
  }

  const out = await call<Json>('support_threads', {
    p_type: type || null,
    p_status: status || null,
    p_since: since || null,
    p_limit: limit,
    p_offset: 0,
    p_needs_human: needsHuman,
    p_cursor: cursor || null,
  })
  if (!out.ok) return { status: out.status, json: { error: out.message, reason: out.reason } }

  return {
    status: 200,
    json: {
      ...out.data,
      generated_at: iso(Date.now()),
      timezone: 'UTC',
      notes: [
        '`since` matches threads created OR updated at or after the timestamp, so an older thread with a new customer message is returned.',
        'A diagnostic has no update timestamp. For those, `since` is the time it arrived.',
        'Page with `cursor`, not an offset: threads reorder as they are answered, and an offset scan silently skips whatever moved up while you were reading. A null `next_cursor` means there is no more.',
        '`hold` names a thread the assistant may never answer: crisis, money, or diagnostic. Held threads also read back as needs_human.',
      ],
    },
  }
}

export async function getThread(id: string): Promise<{ status: number; json: Json }> {
  const out = await call<Json | null>('support_thread', { p_thread: id })
  if (!out.ok) return { status: out.status, json: { error: out.message, reason: out.reason } }
  if (!out.data) {
    return { status: 404, json: { error: 'No thread with that id.', reason: 'not_found' } }
  }
  return { status: 200, json: out.data as Json }
}

export async function replyToThread(
  id: string,
  body: Json,
): Promise<{ status: number; json: Json }> {
  // `body` is the documented field; `text` is accepted too, because the
  // first cut of this endpoint used it.
  const raw = typeof body.body === 'string' ? body.body : body.text
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return { status: 400, json: { error: 'Send { "body": "..." }.', reason: 'empty' } }
  if (text.length > 5000) {
    return { status: 400, json: { error: 'A reply is at most 5000 characters.', reason: 'too_long' } }
  }

  const out = await call<Json>('support_reply', { p_thread: id, p_text: text })
  if (out.ok) {
    // Awaited, not fired and forgotten: a floating promise after the response
    // is written never runs — the serverless instance can be frozen the
    // instant the handler returns. That exact mistake cost the calendar feed
    // its fetch counter.
    const ref = id.startsWith('t:') ? id.slice(2) : ''
    if (ref) await notifyTicketReply(ref)
  }
  if (!out.ok) {
    return {
      status: out.status,
      json: {
        error: out.message,
        // The machine-readable half. A client deciding whether to retry, skip,
        // or escalate needs this, not the sentence.
        reason: out.reason,
      },
    }
  }
  return { status: 201, json: out.data }
}

export async function patchThread(id: string, body: Json): Promise<{ status: number; json: Json }> {
  const hasStatus = 'status' in body && body.status != null
  const hasFlag = 'needs_human' in body && body.needs_human != null
  if (!hasStatus && !hasFlag) {
    return { status: 400, json: { error: 'Send status, needs_human, or both.' } }
  }
  const status = hasStatus ? String(body.status) : null
  if (status && !STATUSES.has(status)) {
    return { status: 400, json: { error: `status must be one of: ${[...STATUSES].join(', ')}.` } }
  }

  const out = await call<Json>('support_patch', {
    p_thread: id,
    p_status: status,
    p_needs_human: hasFlag ? Boolean(body.needs_human) : null,
    // The database refuses `resolved` from this actor. Closing a customer's
    // problem is a judgement with a person's name on it, and the admin UI is
    // where that name is.
    p_actor: 'support',
  })
  if (!out.ok) return { status: out.status, json: { error: out.message, reason: out.reason } }
  return { status: 200, json: out.data }
}

/**
 * The knowledge base, in three shapes.
 *
 * Queried before drafting; the assistant answers from these rather than from
 * memory, and every article carries a `url` so a reply can link the page
 * instead of paraphrasing it into something subtly different.
 *
 * THE LIST AND THE SEARCH DO NOT CARRY BODIES. Forty articles' worth of prose
 * is most of a context window spent on pages that will not be used; a title
 * and a snippet are enough to choose by, and fetching the chosen one makes
 * "answered only from the KB" checkable — the article quoted is the article
 * asked for.
 */
export function kbList(): { status: number; json: Json } {
  return {
    status: 200,
    json: {
      generated_at: iso(Date.now()),
      count: articles().length,
      articles: articles().map((a) => ({
        id: a.slug,
        title: a.title,
        url: a.url,
        summary: a.summary,
        tags: a.tags,
        source: a.source,
      })),
    },
  }
}

export function kbOne(id: string): { status: number; json: Json } {
  const found = article(id)
  if (!found) {
    return { status: 404, json: { error: `No article with id "${id}".`, reason: 'not_found' } }
  }
  return { status: 200, json: { ...found, id: found.slug } }
}

export function kbSearch(q: Json): { status: number; json: Json } {
  const query = String(q.q ?? '').trim()
  if (!query) {
    return { status: 400, json: { error: 'Give a query: /support/kb/search?q=…' } }
  }
  const hits = searchHits(query)
  return {
    status: 200,
    json: {
      generated_at: iso(Date.now()),
      query,
      count: hits.length,
      results: hits,
      notes: hits.length
        ? ['Fetch the full text with GET /api/v1/support/kb/{id} before quoting it.']
        : ['Nothing matched. Do not answer from memory. Escalate with needs_human instead.'],
    },
  }
}
