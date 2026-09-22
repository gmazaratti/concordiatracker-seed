/**
 * /api/v1/orgs — managing a student organisation as a real account.
 *
 * Every call here runs against PostgREST with a token minted for the admin
 * account (see _v1-jwt.ts), so the database's own policies decide what is
 * allowed. This file does not re-check them; it shapes requests and turns a
 * refusal into a sentence. The one rule it is responsible for is REFUSING
 * EARLY with a useful message, because "row-level security" is not an answer
 * anybody can act on.
 *
 * READING IS ADMIN-WIDE, PUBLISHING NEEDS MEMBERSHIP. That split is enforced
 * by RLS via the ct_agent claim, not here. `requireMember` exists only so the
 * refusal says which organisation and what to do about it, one call before
 * the database would have said 42501 with no detail.
 */
import { asUser, rpcAsUser, uploadAsUser } from './_v1-jwt.js'
import { readImage } from './_v1-image.js'

export interface Out {
  status: number
  json: Record<string, unknown>
}

const ok = (json: Record<string, unknown>, status = 200): Out => ({ status, json })
const bad = (status: number, error: string, extra?: Record<string, unknown>): Out => ({
  status,
  json: { error, ...(extra ?? {}) },
})

const ORG_COLS =
  'id,handle,name,bio,logo,banner,color,glyph,verified,status,links,email,venue,translations,owner_id,created_at'

/** Handles are stored with the @. Accept either spelling. */
const norm = (h: string): string => {
  const t = decodeURIComponent(String(h ?? '')).trim()
  return t.startsWith('@') ? t : `@${t}`
}

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

interface OrgRow {
  id: string
  handle: string
  name: string
  status: string | null
  owner_id: string | null
}

async function findOrg(jwt: string, handle: string): Promise<OrgRow | null> {
  const r = await asUser<OrgRow[]>(
    jwt,
    `organizations?handle=eq.${encodeURIComponent(norm(handle))}&select=${ORG_COLS}&limit=1`,
  )
  return r.data?.[0] ?? null
}

/**
 * The publishing gate, asked before the write rather than after.
 *
 * The database would refuse anyway. This exists so the caller is told that it
 * is not on that organisation's team and how to fix it, instead of a bare
 * permission error that reads like the endpoint is broken.
 */
async function requireMember(
  jwt: string,
  userId: string,
  org: OrgRow,
): Promise<Out | null> {
  if (org.owner_id === userId) return null
  const r = await asUser<{ id: string }[]>(
    jwt,
    `org_members?org_id=eq.${org.id}&user_id=eq.${userId}&status=eq.active&select=id&limit=1`,
  )
  if (r.data?.length) return null
  return bad(
    403,
    `This token is not on ${org.handle}'s team, and publishing needs membership.`,
    {
      reason: 'not_a_member',
      hint: `Adding this account to ${org.handle} is a human action, on purpose: an admin does it from their own browser. An agent can only put itself on an organisation it creates.`,
    },
  )
}

function approved(org: OrgRow): Out | null {
  if ((org.status ?? 'pending') === 'approved') return null
  return bad(409, `${org.handle} is "${org.status ?? 'pending'}". An organisation has to be approved before it can publish.`, {
    reason: 'not_approved',
  })
}

/* ── Images ───────────────────────────────────────────────────────────────
 * Decoding, size and format live in _v1-image.ts, which imports nothing so
 * Node can test it directly.
 */

async function storeImage(
  jwt: string,
  userId: string,
  raw: ArrayBuffer,
  contentType: string,
  name: string,
): Promise<{ url: string } | Out> {
  const read = readImage(raw, contentType)
  if ('error' in read) return bad(read.status, read.error)
  const up = await uploadAsUser(jwt, userId, `${name}.${read.kind.ext}`, Buffer.from(read.bytes), read.kind.type)
  if ('error' in up) return bad(502, up.error)
  return up
}

/* ── Organisations ────────────────────────────────────────────────────────*/

export async function listOrgs(jwt: string, q: Record<string, unknown>): Promise<Out> {
  const search = str(q.q)
  const filter = search ? `&or=(name.ilike.*${encodeURIComponent(search)}*,handle.ilike.*${encodeURIComponent(search)}*)` : ''
  const r = await asUser<Record<string, unknown>[]>(
    jwt,
    `organizations?select=${ORG_COLS}&order=created_at.desc&limit=200${filter}`,
  )
  if (!r.ok) return bad(r.status, r.error?.message ?? 'Could not list organisations.')
  return ok({ organizations: r.data ?? [], count: r.data?.length ?? 0 })
}

export async function getOrg(jwt: string, handle: string): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  return ok({ organization: org })
}

/**
 * Create one and join it, in a single statement.
 *
 * admin_create_org deliberately makes an OWNERLESS organisation so a real
 * club can be handed it later, which would leave the agent unable to publish
 * to something it just made. ct_agent_create_org does both at once. There is
 * deliberately no way to join an organisation that already exists — see the
 * note in db/alfred_admin_scope.sql for what that cost when there was.
 */
export async function createOrg(jwt: string, body: Record<string, unknown>): Promise<Out> {
  const name = str(body.name)
  const handle = str(body.handle)
  if (!name || !handle) return bad(400, 'A name and a handle are required.')

  const made = await rpcAsUser<string>(jwt, 'ct_agent_create_org', {
    p_name: name,
    p_handle: norm(handle),
    p_glyph: str(body.glyph) ?? name.slice(0, 2).toUpperCase(),
    p_color: str(body.color) ?? '#4b5563',
    p_bio: str(body.bio) ?? '',
    p_logo: str(body.logo),
    p_banner: str(body.banner),
    p_verified: body.verified === true,
  })
  if (!made.ok) return bad(made.status === 403 ? 403 : 400, made.error?.message ?? 'Could not create that organisation.')

  const id = typeof made.data === 'string' ? made.data : null
  await rpcAsUser(jwt, 'ct_agent_audit', {
    p_action: 'agent.org.create',
    p_target: id,
    p_value: { handle: norm(handle), name },
  })
  const org = await findOrg(jwt, handle)
  return ok({ organization: org, claimed: Boolean(id) }, 201)
}

const PROFILE_FIELDS = ['name', 'bio', 'color', 'glyph', 'email', 'links', 'venue', 'translations', 'logo', 'banner'] as const

export async function patchOrg(
  jwt: string,
  userId: string,
  handle: string,
  body: Record<string, unknown>,
): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const gate = await requireMember(jwt, userId, org)
  if (gate) return gate

  // An allowlist, never a spread: handing a body straight to PostgREST lets a
  // caller set owner_id or status and take an organisation over.
  const patch: Record<string, unknown> = {}
  for (const f of PROFILE_FIELDS) if (f in body) patch[f] = body[f]
  if (Object.keys(patch).length === 0) {
    return bad(400, `Nothing to change. Editable fields: ${PROFILE_FIELDS.join(', ')}.`)
  }

  const r = await asUser<Record<string, unknown>[]>(jwt, `organizations?id=eq.${org.id}&select=${ORG_COLS}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
  })
  if (!r.ok) return bad(r.status, r.error?.message ?? 'Could not update that organisation.')
  await rpcAsUser(jwt, 'ct_agent_audit', {
    p_action: 'agent.org.update',
    p_target: org.id,
    p_value: { handle: org.handle, fields: Object.keys(patch) },
  })
  return ok({ organization: r.data?.[0] ?? null })
}

/** Upload a logo or banner and set it on the profile in one call. */
export async function setOrgImage(
  jwt: string,
  userId: string,
  handle: string,
  kind: 'logo' | 'banner',
  raw: ArrayBuffer,
  contentType: string,
): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const gate = await requireMember(jwt, userId, org)
  if (gate) return gate

  const stored = await storeImage(jwt, userId, raw, contentType, `${org.handle.slice(1)}-${kind}`)
  if ('status' in stored) return stored

  const r = await asUser<Record<string, unknown>[]>(jwt, `organizations?id=eq.${org.id}&select=${ORG_COLS}`, {
    method: 'PATCH',
    body: { [kind]: stored.url },
    prefer: 'return=representation',
  })
  if (!r.ok) return bad(r.status, r.error?.message ?? `Uploaded, but could not set the ${kind}.`)
  await rpcAsUser(jwt, 'ct_agent_audit', { p_action: `agent.org.${kind}`, p_target: org.id, p_value: { url: stored.url } })
  return ok({ url: stored.url, organization: r.data?.[0] ?? null })
}

/** Upload an image and get the URL back, to reference from a post or story. */
export async function uploadMedia(
  jwt: string,
  userId: string,
  raw: ArrayBuffer,
  contentType: string,
): Promise<Out> {
  const stored = await storeImage(jwt, userId, raw, contentType, 'media')
  if ('status' in stored) return stored
  return ok({ url: stored.url }, 201)
}

export { approved, bad, findOrg, norm, ok, requireMember, str }
export type { OrgRow }
