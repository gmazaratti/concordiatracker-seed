import { supabase } from './supabase'
import { demoActivity, demoAssignRole, demoDeleteRole, demoRoleIdFor, demoRoles, demoSaveRole, isDemoOrgId } from './demo-org'

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
  | 'draft_content'
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
  { key: 'draft_content', label: 'Start drafts', hint: 'Write posts and events as drafts. Someone who can publish reviews them and puts them out.', group: 'Posts' },
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
  if (isDemoOrgId(orgId)) return demoRoles(orgId)
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
  if (isDemoOrgId(orgId)) return demoSaveRole(orgId, { ...d, isOwner: false, systemKey: null })
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
  // Demo role ids are `<orgId>:<name>`; a real one is a bare uuid.
  const demoOrg = roleId.includes(':') ? roleId.split(':')[0] : null
  if (demoOrg) {
    const was = demoRoles(demoOrg).find((r) => r.id === roleId)
    return demoSaveRole(demoOrg, { ...d, id: roleId, isOwner: !!was?.isOwner, systemKey: was?.systemKey ?? null })
  }
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
  if (roleId.includes(':')) return demoDeleteRole(roleId.split(':')[0], roleId)
  const { error } = await supabase.rpc('delete_org_role', { p_role: roleId })
  if (error) throw new Error(error.message)
}

export async function setMemberRole(memberId: string, roleId: string): Promise<void> {
  if (roleId.includes(':')) return demoAssignRole(memberId, roleId)
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
  if (isDemoOrgId(orgId)) return demoAssignRole(memberId, `${orgId}:owner`)
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
  // The demo is somebody looking around as the club's owner.
  if (isDemoOrgId(orgId)) return 2147483647
  const { data, error } = await supabase.rpc('ct_org_position', { p_org: orgId })
  if (error) return -1
  return typeof data === 'number' ? data : -1
}

/** The role a member holds. Demo members carry no role id, so theirs comes
 *  from the sandbox; a real row always has one (a trigger fills it). */
export function roleIdOf(
  member: { id: string; role: string; roleId?: string },
  orgId: string,
  roles?: OrgRoleDef[] | null,
): string | undefined {
  if (isDemoOrgId(orgId)) return demoRoleIdFor(orgId, member.role, member.id)
  // An owner by `owner_id` alone has no member row and so no role id; the
  // legacy column still says what they are.
  return member.roleId ?? roles?.find((r) => r.systemKey === member.role)?.id
}

/* ── What the signed-in person may do ─────────────────────────────────────── */

/** Every key, straight from `org_perm` — the function every write policy
 *  asks — plus the two things that are not permission keys. */
export type MyOrgPerms = Record<OrgPermKey, boolean> & {
  view_activity: boolean
  is_owner: boolean
  position: number
}

/** Looking around the demo as its owner. */
export const ALL_MY_PERMS: MyOrgPerms = {
  ...(Object.fromEntries(ORG_PERMS.map((p) => [p.key, true])) as Record<OrgPermKey, boolean>),
  view_activity: true,
  is_owner: true,
  position: 2147483647,
}

export async function loadMyOrgPerms(orgId: string): Promise<MyOrgPerms | null> {
  if (isDemoOrgId(orgId)) return ALL_MY_PERMS
  const { data, error } = await supabase.rpc('my_org_perms', { p_org: orgId })
  if (error || !data) return null
  return data as MyOrgPerms
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
  if (isDemoOrgId(orgId)) return demoActivity()
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
  if (isDemoOrgId(orgId)) return []
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

/* ── One teammate's recent actions (the member panel) ─────────────────────── */

export interface MemberAction {
  id: string
  createdAt: string
  action: string
  detail: string
  revertedAt: string | null
}

/** Same gate as the Activity tab, so a role that cannot read the log cannot
 *  read it one person at a time. */
export async function loadMemberActivity(
  orgId: string,
  actorUser: string,
  limit = 5,
  offset = 0,
): Promise<MemberAction[]> {
  if (isDemoOrgId(orgId)) {
    return demoActivity()
      .filter((a) => a.actorUser === actorUser)
      .slice(offset, offset + limit)
      .map((a) => ({ id: a.id, createdAt: a.createdAt, action: a.action, detail: a.detail, revertedAt: null }))
  }
  const { data, error } = await supabase.rpc('org_member_activity', {
    p_org: orgId,
    p_actor: actorUser,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw new Error(error.message)
  type Row = { id: string; created_at: string; action: string; detail: string | null; reverted_at: string | null }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    action: r.action,
    detail: r.detail ?? '',
    revertedAt: r.reverted_at,
  }))
}

/* ── Presets ──────────────────────────────────────────────────────────────── */

export interface RolePreset {
  id: string
  name: string
  color: string
  icon: string
  /** Where it sits. A preset at or above your own level is shown but cannot
   *  be added — the server would refuse it, and the list says so first. */
  position: number
  permissions: OrgPerms
  canViewActivity: boolean
  blurb: string
}

/**
 * The jobs a student club actually has, each with the permissions it needs
 * and no more. Deleting the club is not among them and cannot be: no
 * permission key expresses it (see db/org_delete_lockdown.sql).
 */
export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'president', name: 'President', color: '#e8b84b', icon: 'Star', position: 90, canViewActivity: true,
    blurb: 'Runs the club: every permission, including the handle and the team.',
    permissions: { post_create: true, post_feed: true, post_edit: true, post_delete: true, event_create: true, event_update: true, draft_content: true, profile_edit: true, handle_change: true, view_insights: true, manage_team: true, roles_grant: true },
  },
  {
    id: 'vp', name: 'Vice-President', color: '#f59e0b', icon: 'Shield', position: 80, canViewActivity: true,
    blurb: 'Everything the president can do, except change the handle.',
    permissions: { post_create: true, post_feed: true, post_edit: true, post_delete: true, event_create: true, event_update: true, draft_content: true, profile_edit: true, view_insights: true, manage_team: true, roles_grant: true },
  },
  {
    id: 'marketing', name: 'Marketing', color: '#ff7ab6', icon: 'Megaphone', position: 40, canViewActivity: false,
    blurb: 'Posts, the profile and the numbers. Not events or the team.',
    permissions: { post_create: true, post_feed: true, post_edit: true, draft_content: true, profile_edit: true, view_insights: true },
  },
  {
    id: 'events', name: 'Events coordinator', color: '#7ad3ff', icon: 'CalendarDays', position: 38, canViewActivity: false,
    blurb: 'Posts and updates events, and sees how they did.',
    permissions: { event_create: true, event_update: true, draft_content: true, view_insights: true },
  },
  {
    id: 'social', name: 'Social media', color: '#c084fc', icon: 'Camera', position: 35, canViewActivity: false,
    blurb: 'Posts and stories, including taking one down.',
    permissions: { post_create: true, post_feed: true, post_edit: true, post_delete: true, draft_content: true },
  },
  {
    id: 'secretary', name: 'Secretary', color: '#94a3b8', icon: 'ClipboardList', position: 32, canViewActivity: true,
    blurb: 'Keeps the team list and the calendar straight.',
    permissions: { event_update: true, draft_content: true, manage_team: true },
  },
  {
    id: 'treasurer', name: 'Treasurer', color: '#34d399', icon: 'Wallet', position: 30, canViewActivity: true,
    blurb: 'Reads the numbers and the log. Drafts only.',
    permissions: { view_insights: true, draft_content: true },
  },
  {
    id: 'intern', name: 'Intern', color: '#9ca3af', icon: 'GraduationCap', position: 5, canViewActivity: false,
    blurb: 'Writes drafts. Somebody who can publish reviews them and posts them.',
    permissions: { draft_content: true },
  },
]
