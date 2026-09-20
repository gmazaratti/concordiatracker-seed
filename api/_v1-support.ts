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
import { articles, search } from './_v1-kb.js'
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
  if (reason === 'not_found') {
    return { ok: false, status: 404, reason, message: err.message ?? 'No thread with that id.' }
  }
  if (
    reason === 'human_takeover' ||
    reason === 'resolved' ||
    reason === 'needs_human' ||
    reason === 'diagnostic_not_repliable' ||
    reason === 'diagnostic_has_no_handling'
  ) {
    return { ok: false, status: 409, reason, message: err.message ?? 'That thread is not open to you.' }
  }
  if (reason === 'empty' || reason === 'bad_status') {
    return { ok: false, status: 400, reason, message: err.message ?? 'Bad request.' }
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

  const perPage = Math.max(1, Math.min(Number(q.per_page) || 50, 200))
  const page = Math.max(1, Number(q.page) || 1)

  const out = await call<Json>('support_threads', {
    p_type: type || null,
    p_status: status || null,
    p_since: since || null,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
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
        'A diagnostic has no update timestamp — for those, `since` is the time it arrived.',
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
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return { status: 400, json: { error: 'Send { "text": "..." }.', reason: 'empty' } }
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
  })
  if (!out.ok) return { status: out.status, json: { error: out.message, reason: out.reason } }
  return { status: 200, json: out.data }
}

/** The knowledge base. Queried before drafting; the assistant answers from
 *  these rather than from memory, and `url` lets a reply link the page. */
export function kb(q: Json): { status: number; json: Json } {
  const query = String(q.q ?? '').trim()
  const found = query ? search(query) : articles()
  return {
    status: 200,
    json: {
      generated_at: iso(Date.now()),
      query: query || null,
      count: found.length,
      articles: found,
    },
  }
}
