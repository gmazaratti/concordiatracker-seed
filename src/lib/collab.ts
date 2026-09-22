import { supabase } from './supabase'

/**
 * Co-authoring a post with another organisation.
 *
 * Every rule lives in `db/post_collaborators.sql` — who may invite, who may
 * answer, that an org cannot invite itself, that a soft-deleted post takes its
 * collaborations with it. This file is a typed way to ask, and it is NOT the
 * guard: each function returns whatever the database decided, as a code, so
 * the UI can say the specific thing rather than "something went wrong".
 */

/** Every answer the RPCs give. Spelled out so a new one cannot quietly become
 *  a generic failure message. */
export type CollabResult =
  | 'ok'
  | 'self'
  | 'no_post'
  | 'no_org'
  | 'not_yours'
  | 'not_approved'
  | 'already_pending'
  | 'already_accepted'
  | 'not_pending'
  | 'not_found'
  | 'error'

const MESSAGE: Record<Exclude<CollabResult, 'ok'>, string> = {
  self: 'A club cannot collaborate with itself.',
  no_post: 'That post is gone.',
  no_org: 'No organisation with that handle.',
  not_yours: 'You cannot act for that organisation.',
  not_approved: 'That organisation is not approved yet, so it cannot be a collaborator.',
  already_pending: 'They already have an invite waiting on this post.',
  already_accepted: 'They are already on this post.',
  not_pending: 'There is no invite waiting on this post.',
  not_found: 'That collaboration is already gone.',
  error: 'Could not reach the server. Try again.',
}

/** Null when it worked; a sentence when it did not. */
export function collabMessage(r: CollabResult): string | null {
  return r === 'ok' ? null : MESSAGE[r]
}

async function call(fn: string, args: Record<string, unknown>): Promise<CollabResult> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) return 'error'
  return (typeof data === 'string' ? data : 'error') as CollabResult
}

export const inviteCollaborator = (postId: string, orgId: string) =>
  call('invite_collaborator', { p_post: postId, p_org: orgId })

export const cancelCollabInvite = (postId: string, orgId: string) =>
  call('cancel_collab_invite', { p_post: postId, p_org: orgId })

export const respondCollabInvite = (postId: string, orgId: string, accept: boolean) =>
  call('respond_collab_invite', { p_post: postId, p_org: orgId, p_accept: accept })

export const removeCollaborator = (postId: string, orgId: string) =>
  call('remove_collaborator', { p_post: postId, p_org: orgId })

/** One row of the portal's list: the same invite, seen from whichever side
 *  the signed-in person is on. */
export interface CollabInvite {
  postId: string
  orgId: string
  direction: 'incoming' | 'outgoing'
  status: 'pending' | 'accepted' | 'declined'
  invitedAt: string
  decidedAt: string | null
  /** Who published the post. */
  author: { orgId: string; handle: string; name: string; logo: string | null; color: string | null; glyph: string | null }
  /** The invited club. On an outgoing row this is who you asked. */
  other: { handle: string; name: string; logo: string | null; color: string | null; glyph: string | null }
  caption: string
  media: { url: string; kind?: 'video' }[]
  createdAt: string
}

interface InviteRow {
  post_id: string
  org_id: string
  direction: string
  status: string
  invited_at: string
  decided_at: string | null
  author_org: string
  author_handle: string
  author_name: string
  author_logo: string | null
  author_color: string | null
  author_glyph: string | null
  other_handle: string
  other_name: string
  other_logo: string | null
  other_color: string | null
  other_glyph: string | null
  caption: string
  media: unknown
  created_at: string
}

export async function listCollabInvites(): Promise<CollabInvite[]> {
  const { data, error } = await supabase.rpc('my_collab_invites')
  // [] on any failure, including the 404 before the migration is applied:
  // a pending migration must cost this one section and never the portal.
  if (error || !Array.isArray(data)) return []
  return (data as InviteRow[]).map((r) => ({
    postId: r.post_id,
    orgId: r.org_id,
    direction: r.direction === 'incoming' ? 'incoming' : 'outgoing',
    status: (r.status as CollabInvite['status']) ?? 'pending',
    invitedAt: r.invited_at,
    decidedAt: r.decided_at,
    author: {
      orgId: r.author_org,
      handle: r.author_handle,
      name: r.author_name,
      logo: r.author_logo,
      color: r.author_color,
      glyph: r.author_glyph,
    },
    other: {
      handle: r.other_handle,
      name: r.other_name,
      logo: r.other_logo,
      color: r.other_color,
      glyph: r.other_glyph,
    },
    caption: r.caption ?? '',
    media: Array.isArray(r.media)
      ? (r.media as Record<string, unknown>[])
          .filter((m) => typeof m?.url === 'string')
          .map((m) => ({ url: m.url as string, kind: m.kind === 'video' ? ('video' as const) : undefined }))
      : [],
    createdAt: r.created_at,
  }))
}

/**
 * Organisations you could ask, for the composer's picker.
 *
 * Reuses `search_public_orgs` when it exists and falls back to a plain
 * filtered read, so the picker works whichever migrations a project has.
 */
export interface OrgOption {
  id: string
  handle: string
  name: string
  logo: string | null
  color: string | null
  glyph: string | null
  verified: boolean
}

export async function searchOrgsToInvite(query: string, excludeId?: string): Promise<OrgOption[]> {
  const q = query.trim()
  let req = supabase
    .from('organizations')
    .select('id, handle, name, logo, color, glyph, verified')
    .eq('status', 'approved')
    .order('name')
    .limit(12)
  if (q) req = req.or(`name.ilike.%${q}%,handle.ilike.%${q}%`)
  const { data, error } = await req
  if (error || !Array.isArray(data)) return []
  return (data as OrgOption[]).filter((o) => o.id !== excludeId)
}
