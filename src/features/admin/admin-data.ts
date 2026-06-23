import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'

/**
 * Admin data layer — every cross-user read/write goes through a SECURITY DEFINER
 * RPC gated on is_admin() (see db/admin_console.sql). The portals' own-rows RLS is
 * untouched and never calls these, so their privacy walls stay intact. A non-admin
 * calling any of these gets a "not authorized" error from the database.
 */

export interface AdminUser {
  user_id: string
  name: string | null
  email: string | null
  created_at: string
  role: string | null
  plan_status: string | null
  plan_expires_at: string | null
  admin_notes: string | null
  can_upload_blueprints: boolean
  vanity_code: string | null
  referred_by_code: string | null
  course_count: number
  assignment_count: number
  following_count: number
  signups_attributed: number
}

export type ApplicationKind = 'request' | 'organization' | 'teacher'
export interface Application {
  kind: ApplicationKind
  ref_id: string
  role: string
  name: string
  email: string
  detail: string
  status: string
  created_at: string
}

export interface PortalTeacher {
  id: string
  user_id: string
  name: string
  email: string
  status: string
  blueprint_count: number
  announcement_count: number
}

export interface PortalOrg {
  id: string
  name: string
  handle: string
  status: string
  verified: boolean
  owner_email: string
  event_count: number
  follower_count: number
  member_count: number
}

export interface OrgMember {
  id: string
  name: string | null
  email: string | null
  role: string
  status: string
}

export interface BugReport {
  id: string
  user_email: string | null
  title: string
  description: string | null
  page: string | null
  status: string
  admin_notes: string | null
  public: boolean
  created_at: string
}

export type ActivityKind = 'user' | 'feature' | 'bug' | 'request' | 'org' | 'teacher'
export interface ActivityItem {
  kind: ActivityKind
  id: string
  title: string
  subtitle: string
  created_at: string
}
export interface ActivityFeed {
  items: ActivityItem[]
  /** When the admin last viewed the feed (null = never). */
  seenAt: string | null
}

const num = (v: unknown) => Number(v ?? 0)

// ── Reads ────────────────────────────────────────────────────────────────────
export async function adminListUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
  return (data ?? []).map((u: AdminUser) => ({
    ...u,
    course_count: num(u.course_count),
    assignment_count: num(u.assignment_count),
    following_count: num(u.following_count),
    signups_attributed: num(u.signups_attributed),
  }))
}

export async function adminListApplications(): Promise<Application[]> {
  const { data, error } = await supabase.rpc('admin_list_applications')
  if (error) throw error
  return (data ?? []) as Application[]
}

export async function adminListPortalTeachers(): Promise<PortalTeacher[]> {
  const { data, error } = await supabase.rpc('admin_list_portal_teachers')
  if (error) throw error
  return (data ?? []).map((t: PortalTeacher) => ({
    ...t,
    blueprint_count: num(t.blueprint_count),
    announcement_count: num(t.announcement_count),
  }))
}

export async function adminListPortalOrgs(): Promise<PortalOrg[]> {
  const { data, error } = await supabase.rpc('admin_list_portal_orgs')
  if (error) throw error
  return (data ?? []).map((o: PortalOrg) => ({
    ...o,
    event_count: num(o.event_count),
    follower_count: num(o.follower_count),
    member_count: num(o.member_count),
  }))
}

export async function adminListOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase.rpc('admin_list_org_members', { p_org_id: orgId })
  if (error) throw error
  return (data ?? []) as OrgMember[]
}

export async function adminListBugReports(): Promise<BugReport[]> {
  const { data, error } = await supabase.rpc('admin_list_bug_reports')
  if (error) throw error
  return (data ?? []) as BugReport[]
}

/** The platform activity feed (new users / feedback / applications) + last-seen. */
export async function adminActivityFeed(): Promise<ActivityFeed> {
  const { data, error } = await supabase.rpc('admin_activity_feed')
  if (error) throw error
  const d = (data ?? {}) as { seen_at: string | null; items: ActivityItem[] }
  return { items: d.items ?? [], seenAt: d.seen_at ?? null }
}

export async function adminMarkActivitySeen(): Promise<void> {
  const { error } = await supabase.rpc('admin_mark_activity_seen')
  if (error) throw error
}

/** Count of items newer than the last-seen mark. */
export function countUnseen(items: ActivityItem[], seenMs: number): number {
  return items.filter((i) => new Date(i.created_at).getTime() > seenMs).length
}

// ── Writes (throw on error so the UI can surface + refresh) ───────────────────
export async function adminSetUserNotes(uid: string, notes: string) {
  const { error } = await supabase.rpc('admin_set_user_notes', { p_uid: uid, p_notes: notes })
  if (error) throw error
}
export async function adminSetBlueprintPermission(uid: string, allowed: boolean) {
  const { error } = await supabase.rpc('admin_set_blueprint_permission', { p_uid: uid, p_allowed: allowed })
  if (error) throw error
}
export async function adminSetPlan(uid: string, plan: string, expires: string | null) {
  const { error } = await supabase.rpc('admin_set_plan', { p_uid: uid, p_plan: plan, p_expires: expires })
  if (error) throw error
}
export async function adminSetVanity(uid: string, code: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_set_vanity', { p_uid: uid, p_code: code })
  if (error) throw error
  return data as string
}
export async function adminResolveApplication(kind: ApplicationKind, refId: string, accept: boolean) {
  const { error } = await supabase.rpc('admin_resolve_application', { p_kind: kind, p_ref_id: refId, p_accept: accept })
  if (error) throw error
}
export async function adminSetOrgStatus(orgId: string, status: string) {
  const { error } = await supabase.rpc('admin_set_org_status', { p_org_id: orgId, p_status: status })
  if (error) throw error
}
export async function adminDeleteOrg(orgId: string) {
  const { error } = await supabase.rpc('admin_delete_org', { p_org_id: orgId })
  if (error) throw error
}
export async function adminRemoveOrgMember(memberId: string) {
  const { error } = await supabase.rpc('admin_remove_org_member', { p_member_id: memberId })
  if (error) throw error
}
export async function adminRemoveTeacher(teacherId: string) {
  const { error } = await supabase.rpc('admin_remove_teacher', { p_teacher_id: teacherId })
  if (error) throw error
}
export async function adminUpdateBugReport(id: string, status: string, notes: string, isPublic: boolean) {
  const { error } = await supabase.rpc('admin_update_bug_report', {
    p_id: id,
    p_status: status,
    p_notes: notes,
    p_public: isPublic,
  })
  if (error) throw error
}

// ── Generic loader + formatting helpers ──────────────────────────────────────
/** Load an admin list with loading/error/reload state. */
export function useAdminList<T>(loader: () => Promise<T[]>): {
  items: T[]
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const rows = await loader()
        if (active) {
          setItems(rows)
          setError(null)
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // loader is recreated per render; tick forces an explicit reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const reload = () => {
    setLoading(true)
    setTick((t) => t + 1)
  }
  return { items, loading, error, reload }
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 8) : id
}

// ── Admin gate ────────────────────────────────────────────────────────────────
/** Resolves whether the signed-in user is a platform admin (via the is_admin RPC). */
export function useIsAdmin(): { loading: boolean; isAdmin: boolean } {
  const { user } = useAuth()
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean }>({ loading: true, isAdmin: false })

  useEffect(() => {
    let active = true
    void (async () => {
      if (!user) {
        if (active) setState({ loading: false, isAdmin: false })
        return
      }
      const { data } = await supabase.rpc('is_admin')
      if (active) setState({ loading: false, isAdmin: data === true })
    })()
    return () => {
      active = false
    }
  }, [user])

  return state
}
