import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Feedback data layer. The public board (feature_requests + votes) is read
 * directly (public-read RLS); all WRITES go through SECURITY DEFINER RPCs so
 * pinned/vote_count/tier/status can't be spoofed and moderation is admin-gated.
 * Bug submission reuses bug_reports; the curated "known issues" reads the rows an
 * admin has flagged public.
 */

export interface FeatureRequest {
  id: string
  user_id: string
  author_name: string
  author_tier: string // 'free' | 'pro'
  author_avatar: string | null
  author_handle: string | null
  title: string
  body: string
  status: string // open | planned | in-progress | shipped | declined
  pinned: boolean
  hidden: boolean
  vote_count: number
  created_at: string
}

export interface KnownIssue {
  id: string
  title: string
  description: string | null
  status: string // resolved → "Fixed"; else "Known issue"
  created_at: string
}

export interface ReactionRow {
  request_id: string
  user_id: string
  emoji: string
}
export interface ReactionSummary {
  emoji: string
  count: number
  mine: boolean
}

export interface Comment {
  id: string
  request_id: string
  user_id: string
  author_name: string
  author_tier: string
  author_avatar: string | null
  author_handle: string | null
  is_staff: boolean
  body: string
  hidden: boolean
  created_at: string
}

/** What to show as a post/comment author: @handle if set, else the display name
 * (old seed rows have no handle — fall back gracefully, never blank). */
export function authorLabel(handle: string | null, name: string): string {
  return handle ? `@${handle}` : name
}

/** The emoji palette offered by the "add reaction" picker. */
export const EMOJI_PALETTE = ['❤️', '👍', '🎉', '🚀', '👀', '🔥', '😍', '💯']

/** Request statuses an admin can set (label for the moderation menu). */
export const REQ_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'declined', label: 'Declined' },
]

export type Sort = 'top' | 'new'

// ── Reads ────────────────────────────────────────────────────────────────────
export async function listFeatureRequests(): Promise<FeatureRequest[]> {
  const { data, error } = await supabase
    .from('feature_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FeatureRequest[]
}

/** Every reaction row (public-read) — grouped client-side per request/emoji. */
export async function listReactions(): Promise<ReactionRow[]> {
  const { data, error } = await supabase
    .from('feature_request_reactions')
    .select('request_id, user_id, emoji')
  if (error) return []
  return (data ?? []) as ReactionRow[]
}

/** request_id → comment count (visible comments only, via RLS). */
export async function listCommentCounts(): Promise<Map<string, number>> {
  const { data } = await supabase.from('feature_request_comments').select('request_id')
  const m = new Map<string, number>()
  for (const r of (data ?? []) as { request_id: string }[]) {
    m.set(r.request_id, (m.get(r.request_id) ?? 0) + 1)
  }
  return m
}

export async function listComments(requestId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('feature_request_comments')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Comment[]
}

/** Reactions for one request, grouped by emoji (highest count first). */
export function summarizeReactions(
  rows: ReactionRow[],
  requestId: string,
  myUserId: string | null,
): ReactionSummary[] {
  const byEmoji = new Map<string, { count: number; mine: boolean }>()
  for (const r of rows) {
    if (r.request_id !== requestId) continue
    const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false }
    cur.count++
    if (myUserId && r.user_id === myUserId) cur.mine = true
    byEmoji.set(r.emoji, cur)
  }
  return [...byEmoji.entries()]
    .map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }))
    .sort((a, b) => b.count - a.count)
}

export function totalReactions(rows: ReactionRow[], requestId: string): number {
  return rows.reduce((n, r) => n + (r.request_id === requestId ? 1 : 0), 0)
}

export async function listKnownIssues(): Promise<KnownIssue[]> {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('id,title,description,status,created_at')
    .eq('public', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as KnownIssue[]
}

// ── Writes ────────────────────────────────────────────────────────────────────
export async function submitFeatureRequest(title: string, body: string) {
  const { error } = await supabase.rpc('submit_feature_request', { p_title: title, p_body: body })
  if (error) throw error
}

export async function toggleReaction(requestId: string, emoji: string) {
  const { error } = await supabase.rpc('toggle_feature_reaction', { p_request_id: requestId, p_emoji: emoji })
  if (error) throw error
}

export async function addComment(requestId: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_feature_comment', { p_request_id: requestId, p_body: body })
  if (error) throw error
  return data as string
}

export async function deleteOwnComment(id: string) {
  const { error } = await supabase.from('feature_request_comments').delete().eq('id', id)
  if (error) throw error
}

export async function adminModerateComment(id: string, hidden: boolean) {
  const { error } = await supabase.rpc('admin_moderate_comment', { p_id: id, p_hidden: hidden })
  if (error) throw error
}

export async function adminDeleteComment(id: string) {
  const { error } = await supabase.rpc('admin_delete_comment', { p_id: id })
  if (error) throw error
}

export async function submitBug(input: {
  title: string
  description: string
  page: string
  userId: string | null
  userEmail: string | null
}) {
  const { error } = await supabase.from('bug_reports').insert({
    user_id: input.userId,
    user_email: input.userEmail,
    title: input.title.trim(),
    description: input.description.trim(),
    page: input.page.trim() || null,
  })
  if (error) throw error
}

// ── Admin moderation ──────────────────────────────────────────────────────────
export async function adminModerateRequest(
  id: string,
  patch: { pinned: boolean; hidden: boolean; status: string },
) {
  const { error } = await supabase.rpc('admin_moderate_request', {
    p_id: id,
    p_pinned: patch.pinned,
    p_hidden: patch.hidden,
    p_status: patch.status,
  })
  if (error) throw error
}

export async function adminDeleteRequest(id: string) {
  const { error } = await supabase.rpc('admin_delete_request', { p_id: id })
  if (error) throw error
}

// ── Basic content guard (server has the backstop; this is the friendly client side) ──
const BANNED = /\b(fuck|shit|cunt|nigger|faggot|retard|bitch)\b/i
export function guardContent(title: string, body: string): string | null {
  const t = title.trim()
  if (t.length < 3) return 'Add a short, clear title (at least 3 characters).'
  if (t.length > 120) return 'Title is too long (120 characters max).'
  if (body.length > 2000) return 'Description is too long (2000 characters max).'
  if (BANNED.test(`${title} ${body}`)) return 'Please keep it respectful — that wording is blocked.'
  return null
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return m === 1 ? '1 minute ago' : `${m} minutes ago`
  const h = Math.floor(m / 60)
  if (h < 24) return h === 1 ? 'about 1 hour ago' : `${h} hours ago`
  const d = Math.floor(h / 24)
  if (d < 30) return d === 1 ? '1 day ago' : `${d} days ago`
  return fmtDate(iso)
}

// ── Generic loader ────────────────────────────────────────────────────────────
export function useList<T>(loader: () => Promise<T[]>): {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const reload = () => {
    setLoading(true)
    setTick((t) => t + 1)
  }
  return { items, loading, error, reload }
}
