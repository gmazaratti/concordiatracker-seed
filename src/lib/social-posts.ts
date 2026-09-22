import { supabase } from './supabase'

/**
 * Posts, reposts and stories — the read/write surface for the publishing half
 * of Community.
 *
 * Every rule lives in `db/social_posts.sql`: only an APPROVED organisation may
 * publish, stories expire after 24 hours, and a club sees how many people
 * watched a story but never which ones. This file is a typed way to ask. It is
 * not the guard and must never be treated as one.
 */

export interface PostMedia {
  url: string
  /** Absent means a picture. Stored on the row, because guessing from the file
   *  extension breaks the moment a URL carries a query string. */
  kind?: 'video'
  /** Natural size, when the uploader could read it. Used to reserve the right
   *  box before the bytes land — see `postAspect`. */
  w?: number
  h?: number
}

/**
 * The shape of a card, from the FIRST piece of media.
 *
 * Instagram's range, and the reasons are theirs and good: a portrait taller
 * than 4:5 eats a whole phone screen and pushes the caption and the actions
 * off it; a panorama wider than 1.91:1 becomes a stripe you cannot see
 * anything in. Anything outside that gets letterboxed inside the nearest
 * allowed box rather than being cropped to a square, which is what the old
 * hard-coded `aspect-square` did to every portrait ever posted.
 *
 * ONE SHAPE FOR THE WHOLE CARROUSEL, taken from the first slide. Sizing each
 * slide to itself makes the page jump as you swipe, and the caption underneath
 * move with it.
 */
export function postAspect(media: PostMedia[]): number {
  const first = media[0]
  if (!first?.w || !first?.h) return 1
  return Math.min(1.91, Math.max(0.8, first.w / first.h))
}

export interface FeedPost {
  id: string
  orgId: string
  handle: string
  orgName: string
  logo: string | null
  color: string | null
  glyph: string | null
  verified: boolean
  caption: string
  media: PostMedia[]
  createdAt: string
  likes: number
  comments: number
  reposts: number
  iLike: boolean
  iRepost: boolean
}

interface PostRow {
  id: string
  org_id: string
  handle: string
  org_name: string
  logo: string | null
  color: string | null
  glyph: string | null
  verified: boolean
  caption: string
  media: unknown
  created_at: string
  likes: number
  comments: number
  reposts: number
  i_like: boolean
  i_repost: boolean
}

/** Media is jsonb, so it arrives as `unknown`. Anything that is not a list of
 *  objects with a url is dropped rather than rendered as a broken frame. */
function toMedia(raw: unknown): PostMedia[] {
  if (!Array.isArray(raw)) return []
  const out: PostMedia[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    const row = m as { url?: unknown; kind?: unknown; w?: unknown; h?: unknown }
    if (typeof row.url !== 'string' || !row.url) continue
    const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined)
    out.push({
      url: row.url,
      // Anything other than the one value we write is a picture. A kind we do
      // not recognise must not become a <video> pointed at a JPEG.
      kind: row.kind === 'video' ? 'video' : undefined,
      w: num(row.w),
      h: num(row.h),
    })
  }
  return out
}

function toPost(r: PostRow): FeedPost {
  return {
    id: r.id,
    orgId: r.org_id,
    handle: r.handle,
    orgName: r.org_name,
    logo: r.logo,
    color: r.color,
    glyph: r.glyph,
    verified: !!r.verified,
    caption: r.caption ?? '',
    media: toMedia(r.media),
    createdAt: r.created_at,
    likes: r.likes ?? 0,
    comments: r.comments ?? 0,
    reposts: r.reposts ?? 0,
    iLike: !!r.i_like,
    iRepost: !!r.i_repost,
  }
}

export async function loadPosts(opts: {
  orgId?: string
  following?: boolean
  limit?: number
  offset?: number
} = {}): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc('post_feed', {
    p_org: opts.orgId ?? null,
    p_following: opts.following ?? false,
    p_limit: opts.limit ?? 20,
    p_offset: opts.offset ?? 0,
  })
  if (error || !Array.isArray(data)) return []
  return (data as PostRow[]).map(toPost)
}

export async function publishPost(
  orgId: string,
  caption: string,
  media: PostMedia[],
): Promise<string | null> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 'You need to be signed in.'
  if (media.length === 0) return 'Add at least one photo or video.'
  const { error } = await supabase.from('org_posts').insert({
    org_id: orgId,
    author_user: me.user.id,
    caption: caption.trim(),
    media,
  })
  // 42501 is RLS: the only way to reach it is publishing as an org you do not
  // run, or one that has not been approved yet.
  if (error) {
    return error.code === '42501'
      ? 'Your organisation has to be approved before it can post.'
      : 'Could not publish that.'
  }
  return null
}

export async function deletePost(id: string): Promise<boolean> {
  const { error } = await supabase.from('org_posts').update({ deleted: true }).eq('id', id)
  return !error
}

/** Returns the new state, or null if the write was refused. Optimistic
 *  callers put the heart back when this comes back null. */
export async function togglePostLike(postId: string, like: boolean): Promise<boolean | null> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return null
  if (like) {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: postId, user_id: me.user.id })
    // 23505 = already liked, which means the answer is still "liked".
    return !error || error.code === '23505' ? true : null
  }
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', me.user.id)
  return error ? null : false
}

export interface PostComment {
  id: string
  userId: string
  handle: string
  name: string | null
  avatarUrl: string | null
  body: string
  createdAt: string
  isMine: boolean
}

export async function loadComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase.rpc('post_comment_list', { p_post: postId })
  if (error || !Array.isArray(data)) return []
  return (
    data as {
      id: string
      user_id: string
      handle: string
      name: string | null
      avatar_url: string | null
      body: string
      created_at: string
      is_mine: boolean
    }[]
  ).map((c) => ({
    id: c.id,
    userId: c.user_id,
    handle: c.handle,
    name: c.name,
    avatarUrl: c.avatar_url,
    body: c.body,
    createdAt: c.created_at,
    isMine: !!c.is_mine,
  }))
}

export async function addComment(postId: string, body: string): Promise<string | null> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 'You need to be signed in.'
  const text = body.trim()
  if (!text) return 'Write something first.'
  const { error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, user_id: me.user.id, body: text })
  return error ? 'Could not post that comment.' : null
}

export async function hideComment(id: string): Promise<boolean> {
  const { error } = await supabase.from('post_comments').update({ deleted: true }).eq('id', id)
  return !error
}

// ── Reposts ─────────────────────────────────────────────────────────────────

export type RepostKind = 'event' | 'post'

/** Returns the new state. Acting as an org when `asOrg` is given and allowed. */
export async function toggleRepost(
  kind: RepostKind,
  targetId: string,
  asOrg?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_repost', {
    p_kind: kind,
    p_target: targetId,
    p_as_org: asOrg ?? null,
  })
  if (error) return false
  return data === true
}

export interface RepostRow {
  id: string
  kind: RepostKind
  targetId: string
  note: string | null
  createdAt: string
}

export async function loadReposts(handle: string, isOrg = false): Promise<RepostRow[]> {
  const { data, error } = await supabase.rpc('repost_list', {
    p_handle: handle.replace(/^@/, ''),
    p_is_org: isOrg,
  })
  if (error || !Array.isArray(data)) return []
  return (
    data as { id: string; target_kind: RepostKind; target_id: string; note: string | null; created_at: string }[]
  ).map((r) => ({
    id: r.id,
    kind: r.target_kind,
    targetId: r.target_id,
    note: r.note,
    createdAt: r.created_at,
  }))
}

export interface EventRepostState {
  reposts: number
  iRepost: boolean
}

/** Events live in their own table with text ids, so they cannot ride the post
 *  feed's counts — one call covers a screenful. */
export async function eventRepostStates(
  ids: string[],
): Promise<Record<string, EventRepostState>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase.rpc('event_repost_state', { p_events: ids })
  if (error || !Array.isArray(data)) return {}
  const out: Record<string, EventRepostState> = {}
  for (const r of data as { event_id: string; reposts: number; i_repost: boolean }[]) {
    out[r.event_id] = { reposts: r.reposts ?? 0, iRepost: !!r.i_repost }
  }
  return out
}

// ── Stories ─────────────────────────────────────────────────────────────────

export interface StoryRing {
  orgId: string
  handle: string
  name: string
  logo: string | null
  color: string | null
  glyph: string | null
  verified: boolean
  total: number
  unseen: number
  latestAt: string
  cover: string | null
}

export async function loadStoryRings(): Promise<StoryRing[]> {
  const { data, error } = await supabase.rpc('live_stories')
  if (error || !Array.isArray(data)) return []
  return (
    data as {
      org_id: string
      handle: string
      name: string
      logo: string | null
      color: string | null
      glyph: string | null
      verified: boolean
      total: number
      unseen: number
      latest_at: string
      cover: string | null
    }[]
  ).map((r) => ({
    orgId: r.org_id,
    handle: r.handle,
    name: r.name,
    logo: r.logo,
    color: r.color,
    glyph: r.glyph,
    verified: !!r.verified,
    total: r.total ?? 0,
    unseen: r.unseen ?? 0,
    latestAt: r.latest_at,
    cover: r.cover,
  }))
}

/** A caption the club dragged onto the image. Positions are FRACTIONS of the
 *  frame so the same story lands in the same place on a phone and a laptop. */
export interface StoryOverlay {
  text: string
  x: number
  y: number
  font: 'modern' | 'classic' | 'signature' | 'typewriter'
  color: string
  /** A solid pill behind the text, for the case where the photo is busy. */
  chip: boolean
  anim: 'none' | 'rise' | 'fade' | 'pop'
}

export interface Story {
  id: string
  imageUrl: string
  caption: string | null
  overlays: StoryOverlay[]
  mentions: string[]
  place: string | null
  linkUrl: string | null
  createdAt: string
  seen: boolean
  liked: boolean
  views: number
}

const FONTS = new Set(['modern', 'classic', 'signature', 'typewriter'])
const ANIMS = new Set(['none', 'rise', 'fade', 'pop'])

/** Overlays are jsonb written by an older or newer client than this one, so
 *  every field is coerced. A story with a malformed overlay still shows its
 *  photo — dropping the whole story would be the worse failure. */
export function toOverlays(raw: unknown): StoryOverlay[] {
  if (!Array.isArray(raw)) return []
  const out: StoryOverlay[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const text = typeof o.text === 'string' ? o.text : ''
    if (!text.trim()) continue
    out.push({
      text,
      x: clamp01(o.x),
      y: clamp01(o.y),
      font: FONTS.has(String(o.font)) ? (o.font as StoryOverlay['font']) : 'modern',
      color: typeof o.color === 'string' ? o.color : '#ffffff',
      chip: o.chip === true,
      anim: ANIMS.has(String(o.anim)) ? (o.anim as StoryOverlay['anim']) : 'none',
    })
  }
  return out
}

function clamp01(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0.5
  return Math.min(1, Math.max(0, n))
}

export async function loadStoryReel(orgId: string): Promise<Story[]> {
  const { data, error } = await supabase.rpc('org_story_reel', { p_org: orgId })
  if (error || !Array.isArray(data)) return []
  return (
    data as {
      id: string
      image_url: string
      caption: string | null
      overlays: unknown
      mentions: string[] | null
      place: string | null
      link_url: string | null
      created_at: string
      seen: boolean
      liked: boolean
      views: number
    }[]
  ).map((s) => ({
    id: s.id,
    imageUrl: s.image_url,
    caption: s.caption,
    overlays: toOverlays(s.overlays),
    mentions: s.mentions ?? [],
    place: s.place,
    linkUrl: s.link_url,
    createdAt: s.created_at,
    seen: !!s.seen,
    liked: !!s.liked,
    views: s.views ?? 0,
  }))
}

export async function markStorySeen(storyId: string, liked?: boolean): Promise<void> {
  await supabase.rpc('mark_story_seen', { p_story: storyId, p_liked: liked ?? null })
}

export async function publishStory(
  orgId: string,
  story: {
    imageUrl: string
    caption?: string
    overlays?: StoryOverlay[]
    mentions?: string[]
    place?: string
    linkUrl?: string
  },
): Promise<string | null> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 'You need to be signed in.'
  const { error } = await supabase.from('org_stories').insert({
    org_id: orgId,
    author_user: me.user.id,
    image_url: story.imageUrl,
    caption: story.caption?.trim() || null,
    overlays: story.overlays ?? [],
    mentions: story.mentions ?? [],
    place: story.place?.trim() || null,
    link_url: story.linkUrl?.trim() || null,
  })
  if (error) {
    return error.code === '42501'
      ? 'Your organisation has to be approved before it can post a story.'
      : 'Could not post that story.'
  }
  return null
}

export async function deleteStory(id: string): Promise<boolean> {
  const { error } = await supabase.from('org_stories').delete().eq('id', id)
  return !error
}
