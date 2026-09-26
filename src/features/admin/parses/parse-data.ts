import { supabase } from '@/lib/supabase'

/**
 * Syllabus-parse health for the admin console (db/parse_tracking.sql).
 *
 * Status is one word, computed in ONE place (`ct_parse_status`) so this tab,
 * the activity feed and the user panel cannot disagree about what happened:
 *   succeeded · failed · processing (under two minutes old) ·
 *   stalled (never finished — the platform stopped it) ·
 *   unknown (from before outcomes were recorded)
 */
export type ParseStatus = 'succeeded' | 'failed' | 'processing' | 'stalled' | 'unknown'

export interface ParseOverview {
  total: number
  succeeded: number
  failed: number
  processing: number
  stalled: number
  unknown: number
  refunded: number
  internal: number
  today: number
  last_success_at: string | null
  last_failure_at: string | null
  median_ms: number | null
  p90_ms: number | null
  zero_items: number
  window: { days: number; total: number; succeeded: number; failed: number; unknown?: number }
  series: { day: string; ok: number; failed: number }[]
  paths: { path: string; n: number; ok: number }[]
  top_errors: { error: string; n: number; last_at: string }[]
  by_user: {
    user_id: string
    name: string | null
    handle: string | null
    email: string | null
    total: number
    ok: number
    failed: number
    last_at: string
  }[]
  by_course: { course: string; total: number; ok: number; failed: number }[]
}

export interface ParseEvent {
  id: string
  created_at: string
  finished_at: string | null
  status: ParseStatus
  refunded: boolean
  error: string | null
  source: string
  file_name: string | null
  bytes: number | null
  path: string | null
  items: number | null
  course_code: string | null
  duration_ms: number | null
  has_file: boolean
  retry_status: 'succeeded' | 'failed' | 'delivered' | null
  retry_error: string | null
  retried_at: string | null
  user_id: string
  name: string | null
  handle: string | null
  email: string | null
  internal: boolean
}

const EMPTY: ParseOverview = {
  total: 0,
  succeeded: 0,
  failed: 0,
  processing: 0,
  stalled: 0,
  unknown: 0,
  refunded: 0,
  internal: 0,
  today: 0,
  last_success_at: null,
  last_failure_at: null,
  median_ms: null,
  p90_ms: null,
  zero_items: 0,
  window: { days: 30, total: 0, succeeded: 0, failed: 0 },
  series: [],
  paths: [],
  top_errors: [],
  by_user: [],
  by_course: [],
}

export async function loadParseOverview(days: number): Promise<ParseOverview> {
  const { data, error } = await supabase.rpc('admin_parse_overview', { p_days: days })
  if (error) throw new Error(error.message)
  // A missing section is an empty section, never a crash.
  return { ...EMPTY, ...((data as Partial<ParseOverview> | null) ?? {}) }
}

export async function loadParseEvents(status: string | null): Promise<ParseEvent[]> {
  const { data, error } = await supabase.rpc('admin_parse_events', { p_status: status, p_limit: 200 })
  if (error) throw new Error(error.message)
  return (data as ParseEvent[] | null) ?? []
}

export interface RetryResult {
  ok: boolean
  items: number
  course: string | null
  error: string | null
  notified: boolean
}

export async function retryParse(id: string): Promise<RetryResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in again.')
  const res = await fetch(`/api/admin?action=parse-retry&id=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const json = (await res.json().catch(() => ({}))) as Partial<RetryResult> & { error?: string; message?: string }
  if (!res.ok) throw new Error(json.message || json.error || `Retry failed (${res.status}).`)
  return { ok: !!json.ok, items: json.items ?? 0, course: json.course ?? null, error: json.error ?? null, notified: !!json.notified }
}

/** Open the stored file (admins can read the private bucket). */
export async function openStoredFile(userId: string, id: string): Promise<void> {
  const { data, error } = await supabase.storage.from('parse-failures').createSignedUrl(`${userId}/${id}.pdf`, 120)
  if (error || !data) throw new Error(error?.message ?? 'Could not open the file.')
  window.open(data.signedUrl, '_blank', 'noopener')
}
