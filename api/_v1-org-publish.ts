/**
 * /api/v1/orgs/{handle}/… — the publishing half: events, posts, stories,
 * invites, team and reach.
 *
 * Split from _v1-orgs.ts because that file is about an organisation's
 * identity and this one is about what it says. Both run as the account, so
 * the database decides; the job here is to refuse early with a sentence the
 * caller can act on, and to record what was published.
 */
import { asUser, rpcAsUser } from './_v1-jwt.js'
import { approved, bad, findOrg, norm, ok, requireMember, str, type OrgRow, type Out } from './_v1-orgs.js'

const EVENT_COLS =
  'id,org_id,title,start,mode,location,category,description,image,relevant_to,posted_at,series_id,recurrence,translations,created_at'

const CATEGORIES = ['clubs', 'career', 'academic', 'official', 'nightlife'] as const
const MODES = ['in-person', 'online'] as const

/** An ISO instant, or a reason it is not one. Never a guess: a date we
 *  invented is a student standing outside a locked building. */
function instant(v: unknown, field: string): string | { error: string } {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return { error: `"${field}" is required, as an ISO-8601 timestamp.` }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return { error: `"${field}" is not a date I can read. Use ISO-8601, e.g. 2026-10-02T18:30:00-04:00.` }
  return d.toISOString()
}

type Gate = { ok: false; out: Out } | { ok: true; org: OrgRow }

async function gate(jwt: string, userId: string, handle: string): Promise<Gate> {
  const org = await findOrg(jwt, handle)
  if (!org) return { ok: false, out: bad(404, `No organisation with the handle ${norm(handle)}.`) }
  const member = await requireMember(jwt, userId, org)
  if (member) return { ok: false, out: member }
  const live = approved(org)
  if (live) return { ok: false, out: live }
  return { ok: true, org }
}

/* ── Events ───────────────────────────────────────────────────────────────*/

export async function listEvents(jwt: string, handle: string, q: Record<string, unknown>): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const upcoming = String(q.upcoming ?? '') === 'true' ? `&start=gte.${new Date().toISOString()}` : ''
  const r = await asUser<Record<string, unknown>[]>(
    jwt,
    `events?org_id=eq.${org.id}&select=${EVENT_COLS}&order=start.desc&limit=200${upcoming}`,
  )
  if (!r.ok) return bad(r.status, r.error?.message ?? 'Could not list events.')
  return ok({ handle: org.handle, events: r.data ?? [], count: r.data?.length ?? 0 })
}

export async function createEvent(
  jwt: string,
  userId: string,
  handle: string,
  body: Record<string, unknown>,
): Promise<Out> {
  const g = await gate(jwt, userId, handle)
  if (!g.ok) return g.out

  const title = str(body.title)
  if (!title) return bad(400, '"title" is required.')
  const start = instant(body.start, 'start')
  if (typeof start !== 'string') return bad(400, start.error)

  const category = str(body.category) ?? 'clubs'
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return bad(400, `"category" must be one of: ${CATEGORIES.join(', ')}.`)
  }
  const mode = str(body.mode) ?? 'in-person'
  if (!(MODES as readonly string[]).includes(mode)) {
    return bad(400, `"mode" must be one of: ${MODES.join(', ')}.`)
  }

  const row = {
    org_id: g.org.id,
    title,
    start,
    mode,
    category,
    location: str(body.location),
    description: str(body.description),
    image: str(body.image),
    relevant_to: Array.isArray(body.relevant_to) ? body.relevant_to : null,
    posted_at: new Date().toISOString(),
    ...(str(body.series_id) ? { series_id: str(body.series_id) } : {}),
    ...(str(body.recurrence) ? { recurrence: str(body.recurrence) } : {}),
  }
  const r = await asUser<Record<string, unknown>[]>(jwt, `events?select=${EVENT_COLS}`, {
    method: 'POST',
    body: row,
    prefer: 'return=representation',
  })
  if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not create that event.')
  const made = r.data?.[0] as { id?: string } | undefined
  await rpcAsUser(jwt, 'ct_agent_audit', {
    p_action: 'agent.event.create',
    p_target: g.org.id,
    p_value: { title, start, event_id: made?.id ?? null },
  })
  return ok({ event: r.data?.[0] ?? null }, 201)
}

const EVENT_FIELDS = ['title', 'start', 'mode', 'location', 'category', 'description', 'image', 'relevant_to', 'translations', 'recurrence'] as const

export async function patchEvent(
  jwt: string,
  userId: string,
  handle: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Out> {
  const g = await gate(jwt, userId, handle)
  if (!g.ok) return g.out

  const patch: Record<string, unknown> = {}
  for (const f of EVENT_FIELDS) if (f in body) patch[f] = body[f]
  if ('start' in patch) {
    const s = instant(patch.start, 'start')
    if (typeof s !== 'string') return bad(400, s.error)
    patch.start = s
  }
  if (Object.keys(patch).length === 0) {
    return bad(400, `Nothing to change. Editable fields: ${EVENT_FIELDS.join(', ')}.`)
  }
  const r = await asUser<Record<string, unknown>[]>(
    jwt,
    `events?id=eq.${encodeURIComponent(id)}&org_id=eq.${g.org.id}&select=${EVENT_COLS}`,
    { method: 'PATCH', body: patch, prefer: 'return=representation' },
  )
  if (!r.ok) return bad(r.status, r.error?.message ?? 'Could not update that event.')
  if (!r.data?.length) return bad(404, `${norm(handle)} has no event with that id.`)
  await rpcAsUser(jwt, 'ct_agent_audit', {
    p_action: 'agent.event.update',
    p_target: g.org.id,
    p_value: { event_id: id, fields: Object.keys(patch) },
  })
  return ok({ event: r.data[0] })
}

/* ── Posts ────────────────────────────────────────────────────────────────*/

export async function listPosts(jwt: string, handle: string): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const r = await asUser<Record<string, unknown>[]>(
    jwt,
    `org_posts?org_id=eq.${org.id}&deleted=is.false&select=id,caption,media,created_at,edited_at&order=created_at.desc&limit=100`,
  )
  if (!r.ok) return bad(r.status, r.error?.message ?? 'Could not list posts.')
  return ok({ handle: org.handle, posts: r.data ?? [], count: r.data?.length ?? 0 })
}

export async function createPost(
  jwt: string,
  userId: string,
  handle: string,
  body: Record<string, unknown>,
): Promise<Out> {
  const g = await gate(jwt, userId, handle)
  if (!g.ok) return g.out

  // The client stores media as [{url}], and the table's CHECK wants an array
  // of one to ten. A bare list of strings is what an agent will send, so it
  // is accepted and normalised rather than refused on a technicality.
  const raw = body.media
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  const media = list
    .map((m) => (typeof m === 'string' ? { url: m } : (m as { url?: unknown })))
    .filter((m): m is { url: string } => typeof m?.url === 'string' && m.url.trim() !== '')
  if (media.length === 0) {
    return bad(400, 'A post needs at least one image. Upload with POST /api/v1/orgs/{handle}/media and pass the URLs as "media".')
  }
  if (media.length > 10) return bad(400, 'A post can carry at most ten images.')

  const caption = str(body.caption) ?? ''
  if (caption.length > 2200) return bad(400, 'A caption can be at most 2200 characters.')

  const r = await asUser<Record<string, unknown>[]>(jwt, 'org_posts?select=id,caption,media,created_at', {
    method: 'POST',
    body: { org_id: g.org.id, author_user: userId, caption, media },
    prefer: 'return=representation',
  })
  if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not publish that post.')
  const made = r.data?.[0] as { id?: string } | undefined
  await rpcAsUser(jwt, 'ct_agent_audit', {
    p_action: 'agent.post.create',
    p_target: g.org.id,
    p_value: { post_id: made?.id ?? null, images: media.length },
  })
  return ok({ post: r.data?.[0] ?? null }, 201)
}

/** Soft delete, the same write the composer makes. Not the destructive kind
 *  held back behind an opt-in: the row stays and the feed stops showing it. */
export async function hidePost(jwt: string, userId: string, handle: string, id: string): Promise<Out> {
  const g = await gate(jwt, userId, handle)
  if (!g.ok) return g.out
  const r = await asUser<Record<string, unknown>[]>(
    jwt,
    `org_posts?id=eq.${encodeURIComponent(id)}&org_id=eq.${g.org.id}&select=id`,
    { method: 'PATCH', body: { deleted: true }, prefer: 'return=representation' },
  )
  if (!r.ok) return bad(r.status, r.error?.message ?? 'Could not remove that post.')
  if (!r.data?.length) return bad(404, `${norm(handle)} has no post with that id.`)
  await rpcAsUser(jwt, 'ct_agent_audit', { p_action: 'agent.post.hide', p_target: g.org.id, p_value: { post_id: id } })
  return ok({ hidden: true, post_id: id })
}

/* ── Stories ──────────────────────────────────────────────────────────────*/

export async function listStories(jwt: string, handle: string): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const r = await asUser<Record<string, unknown>[]>(
    jwt,
    `org_stories?org_id=eq.${org.id}&expires_at=gt.${new Date().toISOString()}&select=id,image_url,caption,place,link_url,overlays,created_at,expires_at&order=created_at.desc`,
  )
  if (!r.ok) return bad(r.status, r.error?.message ?? 'Could not list stories.')
  return ok({ handle: org.handle, stories: r.data ?? [], note: 'A story is gone 24 hours after it is posted; expired ones are not listed.' })
}

export async function createStory(
  jwt: string,
  userId: string,
  handle: string,
  body: Record<string, unknown>,
): Promise<Out> {
  const g = await gate(jwt, userId, handle)
  if (!g.ok) return g.out
  const image = str(body.image_url) ?? str(body.image)
  if (!image) {
    return bad(400, 'A story needs an image. Upload with POST /api/v1/orgs/{handle}/media and pass the URL as "image_url".')
  }
  const r = await asUser<Record<string, unknown>[]>(jwt, 'org_stories?select=id,image_url,caption,created_at,expires_at', {
    method: 'POST',
    body: {
      org_id: g.org.id,
      author_user: userId,
      image_url: image,
      caption: str(body.caption),
      overlays: Array.isArray(body.overlays) ? body.overlays : [],
      mentions: Array.isArray(body.mentions) ? body.mentions : [],
      place: str(body.place),
      link_url: str(body.link_url),
    },
    prefer: 'return=representation',
  })
  if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not post that story.')
  const made = r.data?.[0] as { id?: string } | undefined
  await rpcAsUser(jwt, 'ct_agent_audit', { p_action: 'agent.story.create', p_target: g.org.id, p_value: { story_id: made?.id ?? null } })
  return ok({ story: r.data?.[0] ?? null }, 201)
}

/* ── Team and invites ─────────────────────────────────────────────────────*/

export async function getTeam(jwt: string, handle: string): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const r = await asUser<Record<string, unknown>[]>(
    jwt,
    `org_members?org_id=eq.${org.id}&select=id,name,email,role,status,permissions,joined_at,created_at,invite_token&order=created_at.asc`,
  )
  if (!r.ok) return bad(r.status, r.error?.message ?? 'Could not read the team.')
  const members = (r.data ?? []).map((m) => ({
    ...m,
    // The token is the credential in the link. Whether one is outstanding is
    // the useful fact; the value itself is not, and a list endpoint is the
    // wrong place to hand it back.
    invite_token: undefined,
    invite_pending: Boolean(m.invite_token) && m.status !== 'active',
  }))
  return ok({ handle: org.handle, members, count: members.length })
}

const ROLES = ['owner', 'admin', 'member'] as const

export async function createInvite(
  jwt: string,
  userId: string,
  handle: string,
  body: Record<string, unknown>,
  origin: string,
): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const member = await requireMember(jwt, userId, org)
  if (member) return member

  const kind = str(body.kind) ?? 'team'
  const token = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

  if (kind === 'team') {
    const role = str(body.role) ?? 'member'
    if (!(ROLES as readonly string[]).includes(role)) return bad(400, `"role" must be one of: ${ROLES.join(', ')}.`)
    const r = await asUser<Record<string, unknown>[]>(jwt, 'org_members?select=id,name,email,role,status,created_at', {
      method: 'POST',
      body: {
        org_id: org.id,
        name: str(body.name) ?? str(body.email) ?? 'Invited',
        email: str(body.email),
        role,
        status: 'invited',
        invite_token: token,
        permissions: body.permissions ?? null,
      },
      prefer: 'return=representation',
    })
    if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not create that invite.')
    await rpcAsUser(jwt, 'ct_agent_audit', { p_action: 'agent.invite.team', p_target: org.id, p_value: { role, email: str(body.email) } })
    return ok({ kind: 'team', invite: r.data?.[0] ?? null, url: `${origin}/organizer/join/${token}` }, 201)
  }

  if (kind === 'org') {
    const days = Number(body.expires_in_days ?? 14)
    const r = await asUser<Record<string, unknown>[]>(jwt, 'org_invites?select=id,token,org_id,recipient_email,max_uses,use_count,expires_at,created_at', {
      method: 'POST',
      body: {
        token,
        org_id: org.id,
        org_name: org.name,
        org_handle: org.handle,
        recipient_email: str(body.email),
        max_uses: Number(body.max_uses ?? 1),
        expires_at: new Date(Date.now() + (Number.isFinite(days) ? days : 14) * 86400000).toISOString(),
      },
      prefer: 'return=representation',
    })
    if (!r.ok) return bad(r.status === 403 ? 403 : 400, r.error?.message ?? 'Could not create that invite.')
    await rpcAsUser(jwt, 'ct_agent_audit', { p_action: 'agent.invite.org', p_target: org.id, p_value: { email: str(body.email) } })
    return ok({ kind: 'org', invite: r.data?.[0] ?? null, url: `${origin}/organizer/invite/${token}` }, 201)
  }

  return bad(400, '"kind" must be "team" (add somebody to this org) or "org" (a link that hands the whole org over).')
}

export async function listInvites(jwt: string, handle: string, origin: string): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)

  const team = await asUser<Record<string, unknown>[]>(
    jwt,
    `org_members?org_id=eq.${org.id}&invite_token=not.is.null&select=id,name,email,role,status,invite_token,joined_at,created_at&order=created_at.desc`,
  )
  const claim = await asUser<Record<string, unknown>[]>(
    jwt,
    `org_invites?org_id=eq.${org.id}&select=id,token,recipient_email,max_uses,use_count,opened_count,last_opened_at,last_opened_email,expires_at,created_at&order=created_at.desc`,
  )

  return ok({
    handle: org.handle,
    team_invites: (team.data ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      status: m.status,
      accepted: m.status === 'active',
      joined_at: m.joined_at,
      created_at: m.created_at,
      url: `${origin}/organizer/join/${String(m.invite_token)}`,
    })),
    claim_invites: (claim.data ?? []).map((i) => ({
      ...i,
      url: `${origin}/organizer/invite/${String(i.token)}`,
      token: undefined,
      expired: typeof i.expires_at === 'string' ? new Date(i.expires_at) < new Date() : false,
    })),
    note: '"last_opened_email" is whatever was typed on the invite screen, not a verified identity.',
  })
}

/** Revoke by deleting the pending row. An accepted membership is not an
 *  invite, so this refuses it rather than quietly removing a teammate. */
export async function revokeInvite(jwt: string, userId: string, handle: string, id: string): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const member = await requireMember(jwt, userId, org)
  if (member) return member

  const found = await asUser<{ id: string; status: string | null }[]>(
    jwt,
    `org_members?id=eq.${encodeURIComponent(id)}&org_id=eq.${org.id}&select=id,status&limit=1`,
  )
  if (found.data?.length) {
    if (found.data[0].status === 'active') {
      return bad(409, 'That invite has already been accepted, so it is a teammate now. Removing somebody from a team is held back behind a separate opt-in.', {
        reason: 'already_accepted',
      })
    }
    const del = await asUser(jwt, `org_members?id=eq.${encodeURIComponent(id)}&org_id=eq.${org.id}`, { method: 'DELETE' })
    if (!del.ok) return bad(del.status, del.error?.message ?? 'Could not revoke that invite.')
    await rpcAsUser(jwt, 'ct_agent_audit', { p_action: 'agent.invite.revoke', p_target: org.id, p_value: { member_id: id } })
    return ok({ revoked: true, id })
  }

  const del = await asUser(jwt, `org_invites?id=eq.${encodeURIComponent(id)}&org_id=eq.${org.id}`, { method: 'DELETE' })
  if (!del.ok) return bad(del.status, del.error?.message ?? 'Could not revoke that invite.')
  await rpcAsUser(jwt, 'ct_agent_audit', { p_action: 'agent.invite.revoke', p_target: org.id, p_value: { invite_id: id } })
  return ok({ revoked: true, id })
}

/* ── Reach ────────────────────────────────────────────────────────────────*/

/**
 * Aggregate only, and it says so.
 *
 * The standing rule for the organizer portal is that a club sees how many
 * people watched or followed and never which ones. An API is exactly where
 * that would erode quietly, so the numbers come from org_social(), the same
 * function the portal reads, and no identity is assembled here.
 */
export async function orgInsights(jwt: string, handle: string): Promise<Out> {
  const org = await findOrg(jwt, handle)
  if (!org) return bad(404, `No organisation with the handle ${norm(handle)}.`)
  const social = await rpcAsUser<Record<string, unknown>>(jwt, 'org_social', { p_handle: org.handle })
  const events = await asUser<{ id: string }[]>(jwt, `events?org_id=eq.${org.id}&select=id`)
  const posts = await asUser<{ id: string }[]>(jwt, `org_posts?org_id=eq.${org.id}&deleted=is.false&select=id`)
  return ok({
    handle: org.handle,
    social: Array.isArray(social.data) ? social.data[0] ?? social.data : social.data,
    events: events.data?.length ?? 0,
    posts: posts.data?.length ?? 0,
    privacy: 'Counts only. Which students followed, watched or added an event is never returned.',
  })
}
