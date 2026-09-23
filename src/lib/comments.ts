import { isDemoContentId } from './demo-org'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Comments, with one place that knows what a post's comments are.
 *
 * THE BUG THIS EXISTS TO KILL. The card loaded a post's comments ONCE and
 * handed the array to the sheet as an initial value; the sheet then kept its
 * own copy and refetched only when that value was `null`. So a post that had
 * no comments when you first opened it got `[]` — which is not null — and
 * every reopen showed an empty thread, including the comment you had just
 * written, until the whole feed reloaded. Two components each holding a
 * private copy of the same list is the shape of that bug, so there is one
 * copy now and both read it.
 *
 * STALE-WHILE-REVALIDATE, like the profile cache: a thread you have opened
 * before paints immediately and is re-read in the background, and every write
 * invalidates it, so "post a comment and close" cannot leave a stale list
 * behind.
 */

export interface PostComment {
  id: string
  userId: string
  handle: string
  name: string | null
  avatarUrl: string | null
  body: string
  createdAt: string
  isMine: boolean
  /** Null on a top-level comment. Nesting is capped at one level in the
   *  database, so a reply's parent is always top-level. */
  parentId: string | null
  pinnedAt: string | null
  likes: number
  iLike: boolean
  /** Somebody who can act for the posting organisation has liked it. */
  likedByAuthor: boolean
  /** Whether the viewer may pin — the post's own team, and nobody else. */
  canPin: boolean
}

interface Row {
  id: string
  user_id: string
  handle: string
  name: string | null
  avatar_url: string | null
  body: string
  created_at: string
  is_mine: boolean
  parent_id: string | null
  pinned_at: string | null
  likes: number
  i_like: boolean
  liked_by_author: boolean
  can_pin: boolean
}

const toComment = (c: Row): PostComment => ({
  id: c.id,
  userId: c.user_id,
  handle: c.handle,
  name: c.name,
  avatarUrl: c.avatar_url,
  body: c.body,
  createdAt: c.created_at,
  isMine: !!c.is_mine,
  parentId: c.parent_id ?? null,
  pinnedAt: c.pinned_at ?? null,
  likes: c.likes ?? 0,
  iLike: !!c.i_like,
  likedByAuthor: !!c.liked_by_author,
  canPin: !!c.can_pin,
})

export async function fetchComments(postId: string): Promise<PostComment[]> {
  // A sandbox post: nobody has commented, and the database has never seen it.
  if (isDemoContentId(postId)) return []
  const { data, error } = await supabase.rpc('post_comment_list', { p_post: postId })
  if (error || !Array.isArray(data)) return []
  return (data as Row[]).map(toComment)
}

/* ── The shared copy ──────────────────────────────────────────────────── */

const cache = new Map<string, PostComment[]>()
const listeners = new Set<() => void>()
const notify = () => {
  for (const fn of listeners) fn()
}

/** Drop what we hold and tell every open view to re-read. */
export async function refreshComments(postId: string): Promise<PostComment[]> {
  const rows = await fetchComments(postId)
  cache.set(postId, rows)
  notify()
  return rows
}

export function cachedComments(postId: string): PostComment[] | null {
  return cache.get(postId) ?? null
}

/**
 * A thread, and the actions on it.
 *
 * `comments` is null only until the FIRST read for a post; after that it is
 * whatever we last saw, and a refetch replaces it in place.
 */
export function useComments(postId: string, enabled = true): {
  comments: PostComment[] | null
  reload: () => Promise<void>
  add: (body: string, parentId?: string | null) => Promise<string | null>
  like: (id: string) => Promise<void>
  pin: (id: string, pinned: boolean) => Promise<string | null>
  hide: (id: string) => Promise<void>
} {
  const [, bump] = useState(0)

  useEffect(() => {
    const fn = () => bump((n) => n + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    // ALWAYS re-read on open, even when something is cached. The cached copy
    // is what you look at while this runs; it is not a reason to skip it.
    void fetchComments(postId).then((rows) => {
      if (!alive) return
      cache.set(postId, rows)
      notify()
    })
    return () => {
      alive = false
    }
  }, [postId, enabled])

  const reload = useCallback(async () => {
    await refreshComments(postId)
  }, [postId])

  const add = useCallback(
    async (body: string, parentId?: string | null): Promise<string | null> => {
      if (isDemoContentId(postId)) return 'This is the demo: comments are not saved here.'
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) return 'You need to be signed in.'
      const text = body.trim()
      if (!text) return 'Write something first.'
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: me.user.id,
        body: text,
        parent_id: parentId ?? null,
      })
      if (error) return 'Could not post that comment.'
      // Re-read rather than invent the row: the server stamps the id and the
      // time, and a locally-made comment jumps the moment the list refreshes.
      await refreshComments(postId)
      return null
    },
    [postId],
  )

  const like = useCallback(
    async (id: string) => {
      // Optimistic, then corrected. A heart that waits for a round trip is
      // the one interaction people press twice.
      const rows = cache.get(postId)
      if (rows) {
        cache.set(
          postId,
          rows.map((c) =>
            c.id === id ? { ...c, iLike: !c.iLike, likes: c.likes + (c.iLike ? -1 : 1) } : c,
          ),
        )
        notify()
      }
      const { data, error } = await supabase.rpc('toggle_comment_like', { p_comment: id })
      // ALWAYS re-read, even on success. The optimistic patch knows the heart
      // and the count; it cannot know whether "Liked by author" should now be
      // there, because that asks about the POSTING ORG rather than about you
      // — so the club liking a comment left its own label missing until
      // something else refetched.
      if (error || typeof data !== 'boolean') await refreshComments(postId)
      else void refreshComments(postId)
    },
    [postId],
  )

  const pin = useCallback(
    async (id: string, pinned: boolean): Promise<string | null> => {
      const { data, error } = await supabase.rpc('set_comment_pinned', {
        p_comment: id,
        p_pinned: pinned,
      })
      if (error) return 'Could not change that.'
      if (data === 'full') return 'Three comments are pinned already. Unpin one first.'
      if (data === 'not_yours') return 'Only the club that posted this can pin a comment.'
      if (data === 'is_reply') return 'A reply cannot be pinned.'
      await refreshComments(postId)
      return null
    },
    [postId],
  )

  const hide = useCallback(
    async (id: string) => {
      await supabase.from('post_comments').update({ deleted: true }).eq('id', id)
      await refreshComments(postId)
    },
    [postId],
  )

  return { comments: cachedComments(postId), reload, add, like, pin, hide }
}

/**
 * The thread, in the order it is read.
 *
 * PINNED FIRST (up to three, newest pin first), then everything else NEWEST
 * FIRST — which is the opposite of the order the database returns and the
 * order the reference uses: on a post that is hours old, the comment worth
 * seeing is the last one, not the first.
 *
 * Replies hang off their parent in the order they were written, because a
 * conversation reads forwards even when the list it sits in reads backwards.
 */
export interface CommentThread {
  comment: PostComment
  replies: PostComment[]
}

export function buildThreads(rows: PostComment[]): { pinned: CommentThread[]; rest: CommentThread[] } {
  const tops = rows.filter((c) => !c.parentId)
  const byParent = new Map<string, PostComment[]>()
  for (const c of rows) {
    if (!c.parentId) continue
    const list = byParent.get(c.parentId) ?? []
    list.push(c)
    byParent.set(c.parentId, list)
  }
  const thread = (c: PostComment): CommentThread => ({
    comment: c,
    replies: (byParent.get(c.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  })

  const pinned = tops
    .filter((c) => c.pinnedAt)
    .sort((a, b) => (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? ''))
    .slice(0, 3)
    .map(thread)
  const pinnedIds = new Set(pinned.map((p) => p.comment.id))
  const rest = tops
    .filter((c) => !pinnedIds.has(c.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(thread)
  return { pinned, rest }
}
