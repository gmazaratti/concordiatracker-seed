/**
 * /api/v1/reviews: the failed-syllabus review queue, for the assistant (or an
 * admin token). Every rule lives in the database (db/parse_review.sql): who
 * may see the queue, read a file, preview, deliver, undo or resolve. This
 * file only routes, streams the PDF, and writes an audit entry for each file
 * read, since a storage read has no trigger to record it.
 *
 * The assistant can read a file ONLY while its upload is a failed one still
 * waiting for review; the storage policy enforces that, not this code.
 */
import { rpcAsUser } from './_v1-jwt.js'

type Out = { status: number; json: Record<string, unknown>; raw?: { bytes: ArrayBuffer; type: string; name: string } }
const ok = (json: Record<string, unknown>, status = 200): Out => ({ status, json })
const bad = (status: number, error: string): Out => ({ status, json: { error } })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface QueueRow {
  id: string
  user_id: string
  file_name: string | null
  has_file: boolean
  review_status: string
}

async function row(jwt: string, id: string): Promise<QueueRow | null> {
  const r = await rpcAsUser<QueueRow[]>(jwt, 'admin_parse_queue', { p_status: null })
  return (r.data ?? []).find((x) => x.id === id) ?? null
}

export async function listQueue(jwt: string, status: string | null): Promise<Out> {
  const r = await rpcAsUser<unknown[]>(jwt, 'admin_parse_queue', { p_status: status ?? 'queued' })
  if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not read the review queue.')
  return ok({ reviews: r.data ?? [], note: 'Newest first; students who asked to leave it for review lead.' })
}

export async function reviewFile(jwt: string, id: string): Promise<Out> {
  if (!UUID.test(id)) return bad(400, 'That is not a review id.')
  const found = await row(jwt, id)
  if (!found) return bad(404, 'No review with that id that you can see.')
  if (!found.has_file) return bad(404, 'That upload’s file was not kept, or it has been deleted after 30 days.')
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anon) return bad(500, 'The API is not configured on this server.')
  // Read AS the caller: the storage policy decides, not this code. Never
  // from a cache: the storage CDN keeps an authenticated response for the
  // same URL and token, which would outlive the moment the review closed and
  // the policy stopped allowing it (measured: a cache HIT after resolving).
  const res = await fetch(`${url}/storage/v1/object/authenticated/parse-failures/${found.user_id}/${id}.pdf?v=${Date.now()}`, {
    cache: 'no-store',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return bad(res.status === 400 || res.status === 403 ? 403 : 404, 'That file is not available to this token.')
  const bytes = await res.arrayBuffer()
  await rpcAsUser(jwt, 'ct_agent_audit', {
    p_action: 'assistant.parse.file_read',
    p_target: found.user_id,
    p_value: { parse_event: id, bytes: bytes.byteLength },
  })
  return { status: 200, json: {}, raw: { bytes, type: 'application/pdf', name: found.file_name || 'syllabus.pdf' } }
}

function items(body: Record<string, unknown>) {
  return Array.isArray(body.items) ? body.items : []
}

export async function previewReview(jwt: string, id: string, body: Record<string, unknown>): Promise<Out> {
  const r = await rpcAsUser(jwt, 'parse_delivery_preview', {
    p_event: id,
    p_code: String(body.code ?? ''),
    p_term: String(body.term ?? ''),
    p_items: items(body),
  })
  if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not preview that.')
  return ok({ preview: r.data })
}

export async function deliverReview(jwt: string, id: string, body: Record<string, unknown>, asAssistant: boolean): Promise<Out> {
  const r = await rpcAsUser(jwt, asAssistant ? 'assistant_deliver_parse' : 'admin_deliver_parse', {
    p_event: id,
    p_code: String(body.code ?? ''),
    p_title: String(body.title ?? ''),
    p_term: String(body.term ?? ''),
    p_items: items(body),
  })
  if (!r.ok) return bad(r.status === 403 ? 403 : r.error?.code === '23505' ? 409 : 400, r.error?.message ?? 'Could not add that.')
  return ok({ delivered: r.data }, 201)
}

export async function undoReview(jwt: string, id: string): Promise<Out> {
  const r = await rpcAsUser(jwt, 'undo_parse_delivery', { p_event: id })
  if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not undo that.')
  return ok({ undone: r.data })
}

export async function resolveReview(jwt: string, id: string, body: Record<string, unknown>): Promise<Out> {
  const r = await rpcAsUser(jwt, 'resolve_parse_review', { p_event: id, p_note: String(body.note ?? '') })
  if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not resolve that.')
  return ok({ resolved: true })
}

