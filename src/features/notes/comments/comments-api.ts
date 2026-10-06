import { supabase } from '@/lib/supabase'
import { reportWriteError, writeErrorText } from '@/lib/write-errors'

/**
 * Comment threads on a note. A thread is the comments sharing a thread_id;
 * its anchor (two Yjs relative positions) lives on the first comment.
 * Anyone who can see the note can comment; only its author edits a comment's
 * words; owners and editors can resolve (db/notes_collab.sql).
 */
export interface CommentRow {
  id: string
  threadId: string
  userId: string
  body: string
  quote: string | null
  resolved: boolean
  createdAt: string
  anchor: { from: unknown; to: unknown } | null
}

export interface Thread {
  id: string
  quote: string | null
  anchor: CommentRow['anchor']
  resolved: boolean
  comments: CommentRow[]
}

export async function listComments(noteId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('note_comments')
    .select('id,thread_id,user_id,body,quote,resolved,created_at,anchor')
    .eq('note_id', noteId)
    .order('created_at')
  if (error) throw error
  return ((data ?? []) as {
    id: string; thread_id: string; user_id: string; body: string; quote: string | null
    resolved: boolean; created_at: string; anchor: CommentRow['anchor']
  }[]).map((r) => ({
    id: r.id, threadId: r.thread_id, userId: r.user_id, body: r.body, quote: r.quote,
    resolved: r.resolved, createdAt: r.created_at, anchor: r.anchor,
  }))
}

/** Threads in document order is the panel's job; this only groups. */
export function toThreads(rows: CommentRow[]): Thread[] {
  const map = new Map<string, Thread>()
  for (const r of rows) {
    const t = map.get(r.threadId)
    if (t) {
      t.comments.push(r)
      t.resolved = t.resolved || r.resolved
    } else {
      map.set(r.threadId, { id: r.threadId, quote: r.quote, anchor: r.anchor, resolved: r.resolved, comments: [r] })
    }
  }
  return [...map.values()]
}

export async function addComment(init: {
  noteId: string
  threadId: string
  body: string
  quote?: string | null
  anchor?: CommentRow['anchor']
}): Promise<boolean> {
  const { error } = await supabase.from('note_comments').insert({
    note_id: init.noteId,
    thread_id: init.threadId,
    body: init.body.trim().slice(0, 4000),
    quote: init.quote?.slice(0, 500) ?? null,
    anchor: init.anchor ?? null,
  })
  if (error) reportWriteError('Your comment was not posted', writeErrorText(error))
  return !error
}

export async function setThreadResolved(noteId: string, threadId: string, resolved: boolean): Promise<boolean> {
  const { error } = await supabase.from('note_comments').update({ resolved }).eq('note_id', noteId).eq('thread_id', threadId)
  if (error) reportWriteError('The thread was not updated', writeErrorText(error))
  return !error
}

export async function deleteComment(id: string): Promise<boolean> {
  const { error } = await supabase.from('note_comments').delete().eq('id', id)
  if (error) reportWriteError('The comment was not deleted', writeErrorText(error))
  return !error
}
