import { supabase } from './supabase'

/**
 * Roles, the hierarchy, and the audit log — the client half.
 *
 * EVERY RULE LIVES IN THE DATABASE, and this file only asks. `create_org_role`,
 * `set_org_member_role` and `revert_org_activity` are SECURITY DEFINER verbs
 * that check the hierarchy themselves, so nothing here can widen anybody's
 * access by getting a condition wrong — the worst a bug in this file can do is
 * show a button that the server then refuses. That is the right way round.
 */

/** The nine the brief asked for, plus the two the portal already enforced. */
export type OrgPermKey =
  | 'post_create'
  | 'post_feed'
  | 'post_edit'
  | 'post_delete'
  | 'event_create'
  | 'event_update'
  | 'profile_edit'
  | 'handle_change'
  | 'roles_grant'
  | 'manage_team'
  | 'view_insights'

export interface PermMeta {
  key: OrgPermKey
  label: string
  hint: string
  group: 'Posts' | 'Events' | 'The club' | 'People'
}

/**
 * Ordered, and grouped by the thing being acted on rather than by how
 * dangerous it is: somebody setting up a Comms role is looking for "posts",
 * not scanning a flat list of eleven switches for the ones that sound relevant.
 */
export const ORG_PERMS: PermMeta[] = [
  { key: 'post_create', label: 'Write posts and stories', hint: 'Create them. Publishing to the feed is separate.', group: 'Posts' },
  { key: 'post_feed', label: 'Publish to the feed', hint: 'Put a post in front of every student who follows you.', group: 'Posts' },
  { key: 'post_edit', label: 'Edit posts', hint: 'Change one that is already out.', group: 'Posts' },
  { key: 'post_delete', label: 'Delete posts', hint: 'Take one down.', group: 'Posts' },
  { key: 'event_create', label: 'Post events', hint: 'Add an event to Community.', group: 'Events' },
  { key: 'event_update', label: 'Update events', hint: 'Change the time, place or description.', group: 'Events' },
  { key: 'profile_edit', label: 'Edit the profile', hint: 'Name, bio, logo, banner, colour, links.', group: 'The club' },
  { key: 'handle_change', label: 'Change the handle', hint: 'Your address. Every link anybody has shared points at it.', group: 'The club' },
  { key: 'view_insights', label: 'View insights', hint: 'The aggregate reach numbers.', group: 'The club' },
  { key: 'manage_team', label: 'Manage the team', hint: 'Invite people and remove them.', group: 'People' },
  { key: 'roles_grant', label: 'Grant roles', hint: 'Hand out any role below their own — never their own or above.', group: 'People' },
]

export type OrgPerms = Partial<Record<OrgPermKey, boolean>>

export interface OrgRoleDef {
  id: string
  orgId: string
  name: string
  color: string
  icon: string | null
  position: number
  permissions: OrgPerms
  canViewActivity: boolean
  isOwner: boolean
  /** 'owner' | 'admin' | 'member' for the three every club starts with. */
  systemKey: string | null
}

interface RoleRow {
  id: string
  org_id: string
  name: string
  color: string
  icon: string | null
  position: number
  permissions: OrgPerms | null
  can_view_activity: boolean
  is_owner: boolean
  system_key: string | null
}

function fromRow(r: RoleRow): OrgRoleDef {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    position: r.position,
    permissions: r.permissions ?? {},
    canViewActivity: r.can_view_activity,
    isOwner: r.is_owner,
    systemKey: r.system_key,
  }
}

const COLS =
  'id, org_id, name, color, icon, position, permissions, can_view_activity, is_owner, system_key'

export async function loadOrgRoles(orgId: string): Promise<OrgRoleDef[]> {
  const { data, error } = await supabase
    .from('org_roles')
    .select(COLS)
    .eq('org_id', orgId)
    .order('position', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as RoleRow[]).map(fromRow)
}

export interface RoleDraft {
  name: string
  color: string
  icon: string | null
  position: number
  permissions: OrgPerms
  canViewActivity: boolean
}

export async function createOrgRole(orgId: string, d: RoleDraft): Promise<OrgRoleDef> {
  const { data, error } = await supabase.rpc('create_org_role', {
    p_org: orgId,
    p_name: d.name,
    p_color: d.color,
    p_icon: d.icon,
    p_position: d.position,
    p_permissions: d.permissions,
    p_can_view_activity: d.canViewActivity,
  })
  if (error) throw new Error(error.message)
  return fromRow(data as RoleRow)
}

export async function updateOrgRole(roleId: string, d: RoleDraft): Promise<OrgRoleDef> {
  const { data, error } = await supabase.rpc('update_org_role', {
    p_role: roleId,
    p_name: d.name,
    p_color: d.color,
    p_icon: d.icon,
    p_position: d.position,
    p_permissions: d.permissions,
    p_can_view_activity: d.canViewActivity,
  })
  if (error) throw new Error(error.message)
  return fromRow(data as RoleRow)
}

export async function deleteOrgRole(roleId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_org_role', { p_role: roleId })
  if (error) throw new Error(error.message)
}

export async function setMemberRole(memberId: string, roleId: string): Promise<void> {
  const { error } = await supabase.rpc('set_org_member_role', {
    p_member: memberId,
    p_role: roleId,
  })
  if (error) throw new Error(error.message)
}

export async function transferOwnership(
  orgId: string,
  memberId: string,
  stepDown: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('transfer_org_ownership', {
    p_org: orgId,
    p_member: memberId,
    p_step_down: stepDown,
  })
  if (error) throw new Error(error.message)
}

/** Where the signed-in person sits. Owners come back as a huge number, so
 *  "strictly below mine" is one comparison everywhere rather than a special
 *  case repeated at each call site. */
export async function myPosition(orgId: string): Promise<number> {
  const { data, error } = await supabase.rpc('ct_org_position', { p_org: orgId })
  if (error) return -1
  return typeof data === 'number' ? data : -1
}

/* ── The audit log ─────────────────────────────────────────────────────────── */

export interface ActivityEntry {
  id: string
  createdAt: string
  actorUser: string | null
  actorName: string
  actorEmail: string
  action: string
  detail: string
  entityType: string | null
  entityId: string | null
  revertedAt: string | null
  /** Worked out by the server, so an Undo we offer is one it will accept. */
  canRevert: boolean
}

export async function loadActivity(orgId: string, limit = 150): Promise<ActivityEntry[]> {
  const { data, error } = await supabase.rpc('org_activity_feed', {
    p_org: orgId,
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  type Row = {
    id: string
    created_at: string
    actor_user: string | null
    actor_name: string | null
    actor_email: string | null
    action: string
    detail: string | null
    entity_type: string | null
    entity_id: string | null
    reverted_at: string | null
    can_revert: boolean
  }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    actorUser: r.actor_user,
    actorName: r.actor_name ?? 'Someone',
    actorEmail: r.actor_email ?? '',
    action: r.action,
    detail: r.detail ?? '',
    entityType: r.entity_type,
    entityId: r.entity_id,
    revertedAt: r.reverted_at,
    canRevert: !!r.can_revert,
  }))
}

export interface ActivityActor {
  actorUser: string
  actorName: string
  actions: number
  lastAt: string
}

export async function loadActivityActors(orgId: string): Promise<ActivityActor[]> {
  const { data, error } = await supabase.rpc('org_activity_actors', { p_org: orgId })
  if (error) return []
  type Row = { actor_user: string; actor_name: string | null; actions: number; last_at: string }
  return ((data ?? []) as Row[]).map((r) => ({
    actorUser: r.actor_user,
    actorName: r.actor_name ?? 'Someone',
    actions: Number(r.actions),
    lastAt: r.last_at,
  }))
}

export async function revertActivity(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('revert_org_activity', { p_activity: id })
  if (error) throw new Error(error.message)
  return typeof data === 'string' ? data : 'it'
}

export async function revertAllFrom(
  orgId: string,
  actorUser: string,
  from: string | null,
  to: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('revert_org_activity_bulk', {
    p_org: orgId,
    p_actor: actorUser,
    p_from: from,
    p_to: to,
  })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : 0
}
