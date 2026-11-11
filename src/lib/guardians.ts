import { supabase } from './supabase'
import { siteOrigin } from './site-origin'

/** Family access (db/guardians.sql): a student lets a parent see their courses. */
export interface GuardianLink {
  id: string
  guardian: string | null
  invite_email: string | null
  label: string | null
  token: string
  status: 'pending' | 'active' | 'revoked'
  can_see_grades: boolean
  can_see_schedule: boolean
  created_at: string
  accepted_at: string | null
  expires_at: string
}

export function guardianInviteUrl(token: string): string {
  return `${siteOrigin()}/family/join/${token}`
}

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message)
}

export async function myGuardianLinks(): Promise<GuardianLink[]> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return []
  const { data, error } = await supabase
    .from('guardian_links')
    .select('*')
    .eq('student', me.user.id)
    .neq('status', 'revoked')
    .order('created_at')
  fail(error)
  return (data ?? []) as GuardianLink[]
}

export async function inviteGuardian(email: string, label: string): Promise<string> {
  const { data, error } = await supabase.rpc('invite_guardian', { p_email: email, p_label: label })
  fail(error)
  const row = (Array.isArray(data) ? data[0] : data) as { token: string } | undefined
  return row?.token ?? ''
}

export async function setGuardianAccess(id: string, grades: boolean, schedule: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_guardian_access', { p_id: id, p_grades: grades, p_schedule: schedule })
  fail(error)
}

export async function endGuardianLink(id: string): Promise<void> {
  const { error } = await supabase.rpc('end_guardian_link', { p_id: id })
  fail(error)
}

export interface InviteInfo {
  student_name: string
  status: 'pending' | 'active' | 'revoked'
  expired: boolean
  mine: boolean
}

export async function guardianInviteInfo(token: string): Promise<InviteInfo | null> {
  const { data } = await supabase.rpc('guardian_invite_info', { p_token: token })
  return ((Array.isArray(data) ? data[0] : data) as InviteInfo | undefined) ?? null
}

export async function acceptGuardianInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_guardian_invite', { p_token: token })
  fail(error)
  return data as string
}

export interface GuardedStudent {
  student: string
  name: string
  can_see_grades: boolean
  can_see_schedule: boolean
}

export async function myGuardedStudents(): Promise<GuardedStudent[]> {
  const { data } = await supabase.rpc('my_guarded_students')
  return (data ?? []) as GuardedStudent[]
}

export interface GuardianView {
  name: string
  grades: boolean
  schedule: boolean
  courses: {
    id: string
    code: string
    name: string
    term: string | null
    credits: number | null
    time: string | null
    location: string | null
    color: string | null
    final: number | null
    archived: boolean
  }[]
  assessments: {
    id: string
    course: string
    title: string
    kind: string
    weight: number
    due: string | null
    status: string | null
    no_date: boolean | null
    score: number | null
    raw_score: number | null
    raw_total: number | null
  }[]
  schedules: { name: string; term_code: string | null; sections: unknown }[]
}

export async function guardianView(student: string): Promise<GuardianView> {
  const { data, error } = await supabase.rpc('guardian_view', { p_student: student })
  fail(error)
  return data as GuardianView
}

/** Email the invite link (api/ticket.ts, guardian-invite). True when it went out. */
export async function emailGuardianInvite(linkId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) return false
  try {
    const res = await fetch('/api/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ action: 'guardian-invite', linkId }),
    })
    const body = (await res.json().catch(() => null)) as { sent?: boolean } | null
    return !!body?.sent
  } catch {
    return false
  }
}
