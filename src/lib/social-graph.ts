import { supabase } from './supabase'

/**
 * The follow graph, which is now the whole social model.
 *
 * ONE RELATIONSHIP. You follow someone; if they follow back, that mutual IS
 * the connection. Nothing is stored for "connected" — it is derived, so the
 * two can never disagree, and there is no accept step to explain.
 *
 * Everything here is a thin read over SECURITY DEFINER functions. The rules
 * that matter — who may message whom, who is blocked — are enforced in the
 * database, not here; these calls only ask what the answer is so the UI can
 * say something useful instead of failing silently.
 */

/** Why a message cannot be sent. Null means it can. */
export type DmReason =
  | 'auth'
  | 'self'
  | 'blocked'
  | 'closed'
  | 'mutuals-only'
  | 'request-pending'
  | null

export interface MutualPreview {
  handle: string
  name: string | null
  avatar_url: string | null
}

export interface ProfileSocial {
  userId: string
  followers: number
  following: number
  /** Organisations they follow — what replaces Instagram's post count. */
  orgs: number
  iFollow: boolean
  followsMe: boolean
  mutual: boolean
  dmReason: DmReason
  /** At most three, for the "Followed by A, B and N others" row. */
  mutuals: MutualPreview[]
  mutualsTotal: number
}

const EMPTY: ProfileSocial = {
  userId: '',
  followers: 0,
  following: 0,
  orgs: 0,
  iFollow: false,
  followsMe: false,
  mutual: false,
  dmReason: null,
  mutuals: [],
  mutualsTotal: 0,
}

/** Counts, your relationship to them, and the mutuals preview — one call,
 *  because the header renders as a unit and four round trips to draw one
 *  block is how a profile pops into place a piece at a time. */
export async function profileSocial(handle: string): Promise<ProfileSocial | null> {
  const { data, error } = await supabase.rpc('profile_social', { p_handle: handle })
  if (error || !data) return null
  const d = data as Record<string, unknown>
  return {
    ...EMPTY,
    userId: String(d.user_id ?? ''),
    followers: Number(d.followers ?? 0),
    following: Number(d.following ?? 0),
    orgs: Number(d.orgs ?? 0),
    iFollow: d.i_follow === true,
    followsMe: d.follows_me === true,
    mutual: d.mutual === true,
    dmReason: (d.dm_reason ?? null) as DmReason,
    mutuals: (d.mutuals ?? []) as MutualPreview[],
    mutualsTotal: Number(d.mutuals_total ?? 0),
  }
}

export interface FollowRow {
  handle: string
  name: string | null
  avatar_url: string | null
  i_follow: boolean
  is_me: boolean
}

export async function followList(
  handle: string,
  kind: 'followers' | 'following',
  offset = 0,
): Promise<FollowRow[]> {
  const { data, error } = await supabase.rpc('profile_follow_list', {
    p_handle: handle,
    p_kind: kind,
    p_limit: 50,
    p_offset: offset,
  })
  if (error || !Array.isArray(data)) return []
  return data as FollowRow[]
}

/** Follow or unfollow. Returns whether it took — the database refuses a
 *  blocked pair and a self-follow, and the button should not pretend. */
export async function setFollow(handle: string, follow: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('follow_user', {
    p_handle: handle,
    p_follow: follow,
  })
  return !error && data === true
}

/** What to tell someone who cannot send a message. Written from the
 *  RECIPIENT's side, because every one of these is their choice and the
 *  sender is not owed an explanation of their settings beyond the fact. */
export function dmMessage(reason: DmReason): string | null {
  switch (reason) {
    case 'closed':
      return 'This person has messages turned off.'
    case 'mutuals-only':
      return 'They only accept messages from people they follow back.'
    case 'request-pending':
      return 'Your message request is waiting — you can send more once they follow you back.'
    case 'blocked':
      // Says nothing about who blocked whom, in either direction.
      return 'You cannot message this account.'
    default:
      return null
  }
}
