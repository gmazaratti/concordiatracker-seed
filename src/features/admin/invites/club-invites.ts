import { supabase } from '@/lib/supabase'

/** One club invite, as the admin list shows it (see db/club_invites.sql). */
export interface ClubInvite {
  token: string
  org_name: string
  org_handle: string
  mode: 'self' | 'prefilled'
  recipient_email: string | null
  max_uses: number
  use_count: number
  expires_at: string
  created_at: string
  org_id: string | null
  org_status: string | null
  opens: number
  first_open_at: string | null
  last_open_at: string | null
  signed_in_opens: number
  claimed_at: string | null
  claimed_email: string | null
}

export interface InviteEvent {
  kind: 'open' | 'claim' | 'join'
  at: string
  email: string | null
  name: string | null
  handle: string | null
  signed_in: boolean
  visitor: string | null
}

/** Stored as a very large number rather than null, so the database's one
 *  rule (`use_count < max_uses`) needs no special case. Shown as Unlimited. */
export const UNLIMITED = 1_000_000
/** "Never expires" is a date far enough away that it never matters. */
export const NEVER = '2099-12-31T23:59:00.000Z'

export const isUnlimited = (n: number) => n >= UNLIMITED
export const neverExpires = (iso: string) => new Date(iso).getFullYear() >= 2099

export function inviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`
}

export type InviteState = 'unused' | 'opened' | 'claimed' | 'used-up' | 'expired'

export function inviteState(i: ClubInvite, now: number): InviteState {
  if (i.use_count >= i.max_uses) return 'used-up'
  if (new Date(i.expires_at).getTime() < now) return 'expired'
  if (i.use_count > 0) return 'claimed'
  if (i.opens > 0) return 'opened'
  return 'unused'
}

function fail(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message)
}

export async function listClubInvites(): Promise<ClubInvite[]> {
  const { data, error } = await supabase.rpc('admin_club_invites')
  fail(error)
  return (data as ClubInvite[] | null) ?? []
}

export async function inviteEvents(token: string): Promise<InviteEvent[]> {
  const { data, error } = await supabase.rpc('admin_club_invite_events', { p_token: token })
  fail(error)
  return (data as InviteEvent[] | null) ?? []
}

export async function createClubInvite(input: {
  name: string
  handle: string
  mode: 'self' | 'prefilled'
  maxUses: number
  expiresAt: string
  color?: string
  bio?: string
  email?: string
}): Promise<{ token: string; org_id: string | null }> {
  const { data, error } = await supabase.rpc('admin_create_club_invite', {
    p_name: input.name,
    p_handle: input.handle,
    p_mode: input.mode,
    p_max_uses: input.maxUses,
    p_expires_at: input.expiresAt,
    p_color: input.color ?? '#5b9cf6',
    p_bio: input.bio ?? '',
    p_email: input.email ?? null,
  })
  fail(error)
  return data as { token: string; org_id: string | null }
}

export async function updateClubInvite(token: string, maxUses: number, expiresAt: string): Promise<void> {
  const { error } = await supabase.rpc('admin_update_club_invite', {
    p_token: token,
    p_max_uses: maxUses,
    p_expires_at: expiresAt,
  })
  fail(error)
}

export async function deleteClubInvite(token: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_club_invite', { p_token: token })
  fail(error)
}

/** "in 3 days", "2 hours ago" — coarse on purpose; the Info view has exact times. */
export function relTime(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now
  const abs = Math.abs(ms)
  const unit =
    abs < 3_600_000 ? [Math.max(1, Math.round(abs / 60_000)), 'min'] :
    abs < 86_400_000 ? [Math.round(abs / 3_600_000), 'hour'] :
    [Math.round(abs / 86_400_000), 'day']
  const s = `${unit[0]} ${unit[1]}${unit[0] === 1 ? '' : 's'}`
  return ms >= 0 ? `in ${s}` : `${s} ago`
}
