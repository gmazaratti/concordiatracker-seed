import { supabase } from '@/lib/supabase'

/**
 * Team invites that go through the database's own rules (db/org_invite_users.sql).
 *
 * An invite to somebody already on the site is BOUND to their account and
 * arrives in their notifications; an email that belongs to an account is routed
 * to that same path by the server, so a club can never create a second, email-
 * only invite for somebody who could simply have been asked in the app.
 */

export interface Invitee {
  userId: string
  name: string | null
  handle: string | null
  avatarUrl: string | null
  /** Found because the query was their exact email address. */
  byEmail: boolean
  /** Already on this team, or already holding an invite. */
  state: 'member' | 'invited' | null
}

type InviteeRow = {
  user_id: string
  name: string | null
  handle: string | null
  avatar_url: string | null
  by_email: boolean
  state: 'member' | 'invited' | null
}

export async function findInvitees(orgId: string, q: string): Promise<Invitee[]> {
  const { data, error } = await supabase.rpc('org_find_invitees', { p_org: orgId, p_q: q })
  if (error) throw new Error(error.message)
  return ((data as InviteeRow[] | null) ?? []).map((r) => ({
    userId: r.user_id,
    name: r.name,
    handle: r.handle,
    avatarUrl: r.avatar_url,
    byEmail: r.by_email,
    state: r.state,
  }))
}

export async function inviteUser(orgId: string, userId: string, roleId: string): Promise<void> {
  const { error } = await supabase.rpc('org_invite_user', { p_org: orgId, p_user: userId, p_role_id: roleId })
  if (error) throw new Error(error.message)
}

export interface EmailInviteResult {
  token: string
  /** The address belonged to an account, so they were invited in the app. */
  existingUser: boolean
  name: string
}

export async function inviteByEmail(
  orgId: string,
  name: string,
  email: string,
  roleId: string,
): Promise<EmailInviteResult> {
  const { data, error } = await supabase.rpc('org_invite_by_email', {
    p_org: orgId,
    p_name: name,
    p_email: email,
    p_role_id: roleId,
  })
  if (error) throw new Error(error.message)
  const row = (data as { invite_token: string; existing_user: boolean; name: string }[] | null)?.[0]
  if (!row) throw new Error('The invite was not created.')
  return { token: row.invite_token, existingUser: row.existing_user, name: row.name }
}

export interface MemberInviteInfo {
  orgName: string
  memberName: string
  roleName: string
  /** Made for the signed-in account specifically. */
  forYou: boolean
  /** Made for SOME account — so only that account may accept it. */
  bound: boolean
}

export async function memberInviteInfo(token: string): Promise<MemberInviteInfo | null> {
  const { data } = await supabase.rpc('org_member_invite_info', { p_token: token })
  const r = (data as { org_name: string; member_name: string; role_name: string; for_you: boolean; bound: boolean }[] | null)?.[0]
  if (!r) return null
  return { orgName: r.org_name, memberName: r.member_name, roleName: r.role_name, forYou: r.for_you, bound: r.bound }
}

export async function declineMemberInvite(token: string): Promise<boolean> {
  const { data } = await supabase.rpc('decline_org_member_invite', { p_token: token })
  return data === true
}
