import { supabase } from '@/lib/supabase'
import { reportWriteError, writeErrorText } from '@/lib/write-errors'
import type { NoteRole } from './types'

/**
 * Sharing a note or a folder (a class included) with people on the site, or
 * by link. Every write is a database function that checks the caller owns
 * what they are sharing (db/notes_sharing_rpc.sql); nothing here decides who
 * may see what.
 */
export type ShareKind = 'note' | 'folder'
export type ShareRole = 'viewer' | 'editor'

export interface ShareEntry {
  shareId: string
  userId: string | null
  handle: string | null
  name: string | null
  avatarUrl: string | null
  role: ShareRole
  viaLink: boolean
  /** Set on the one row that is the link itself. */
  linkToken: string | null
}

export interface NotePerson {
  userId: string
  handle: string | null
  name: string | null
  avatarUrl: string | null
  role: NoteRole
  lastViewedAt: string | null
  lastEditedAt: string | null
}

export interface SharedItem {
  kind: ShareKind
  id: string
  name: string
  role: ShareRole
  ownerName: string | null
  ownerHandle: string | null
  ownerAvatar: string | null
  sharedAt: string
}

/** Turn a database refusal into a sentence a person can act on. */
function why(err: { message?: string } | null): string {
  const m = err?.message ?? ''
  if (/No one has that handle|That is you|cannot share|Only the owner|turned off|Sign in/.test(m)) return m
  return writeErrorText(err)
}

export async function listShares(kind: ShareKind, id: string): Promise<ShareEntry[]> {
  const { data, error } = await supabase.rpc('note_share_list', { p_kind: kind, p_id: id })
  if (error) throw error
  return (
    (data ?? []) as {
      share_id: string
      user_id: string | null
      handle: string | null
      name: string | null
      avatar_url: string | null
      role: ShareRole
      via_link: boolean
      link_token: string | null
    }[]
  ).map((r) => ({
    shareId: r.share_id,
    userId: r.user_id,
    handle: r.handle,
    name: r.name,
    avatarUrl: r.avatar_url,
    role: r.role,
    viaLink: r.via_link,
    linkToken: r.link_token,
  }))
}

/** Returns an error sentence, or null on success. */
export async function shareWith(kind: ShareKind, id: string, handle: string, role: ShareRole): Promise<string | null> {
  const { error } = await supabase.rpc('share_note_with', { p_kind: kind, p_id: id, p_handle: handle, p_role: role })
  return error ? why(error) : null
}

export async function setShareRole(shareId: string, role: ShareRole): Promise<boolean> {
  const { error } = await supabase.rpc('share_note_set_role', { p_share: shareId, p_role: role })
  if (error) reportWriteError('The role was not changed', why(error))
  return !error
}

export async function removeShare(shareId: string): Promise<boolean> {
  const { error } = await supabase.rpc('share_note_remove', { p_share: shareId })
  if (error) reportWriteError('That person was not removed', why(error))
  return !error
}

/** Link on with a role, or off with null. Returns the token (or null when off). */
export async function setShareLink(kind: ShareKind, id: string, role: ShareRole | null): Promise<string | null> {
  const { data, error } = await supabase.rpc('share_note_link', { p_kind: kind, p_id: id, p_role: role })
  if (error) {
    reportWriteError('The link was not changed', why(error))
    return null
  }
  return (data as string | null) ?? null
}

export function shareLinkUrl(token: string): string {
  return `${window.location.origin}/app/notes/s/${token}`
}

export async function claimLink(token: string): Promise<{ kind: ShareKind; target: string } | { error: string }> {
  const { data, error } = await supabase.rpc('claim_note_link', { p_token: token })
  if (error) return { error: why(error) }
  const row = (Array.isArray(data) ? data[0] : data) as { kind: ShareKind; target: string } | undefined
  return row ?? { error: 'This link was turned off.' }
}

export async function notePeople(noteId: string): Promise<NotePerson[]> {
  const { data, error } = await supabase.rpc('note_people', { p_note: noteId })
  if (error) throw error
  return (
    (data ?? []) as {
      user_id: string
      handle: string | null
      name: string | null
      avatar_url: string | null
      role: NoteRole
      last_viewed_at: string | null
      last_edited_at: string | null
    }[]
  ).map((r) => ({
    userId: r.user_id,
    handle: r.handle,
    name: r.name,
    avatarUrl: r.avatar_url,
    role: r.role,
    lastViewedAt: r.last_viewed_at,
    lastEditedAt: r.last_edited_at,
  }))
}

export async function sharedWithMe(): Promise<SharedItem[]> {
  const { data, error } = await supabase.rpc('notes_shared_with_me')
  if (error) throw error
  return (
    (data ?? []) as {
      kind: ShareKind
      id: string
      name: string
      role: ShareRole
      owner_name: string | null
      owner_handle: string | null
      owner_avatar: string | null
      shared_at: string
    }[]
  ).map((r) => ({
    kind: r.kind,
    id: r.id,
    name: r.name,
    role: r.role,
    ownerName: r.owner_name,
    ownerHandle: r.owner_handle,
    ownerAvatar: r.owner_avatar,
    sharedAt: r.shared_at,
  }))
}

export async function noteRole(noteId: string): Promise<NoteRole | null> {
  const { data, error } = await supabase.rpc('ct_note_role', { p_note: noteId })
  return error ? null : ((data as NoteRole | null) ?? null)
}

export async function folderRole(folderId: string): Promise<NoteRole | null> {
  const { data, error } = await supabase.rpc('ct_folder_role', { p_folder: folderId })
  return error ? null : ((data as NoteRole | null) ?? null)
}

/** Record that I looked at (or edited) a note, for the people list. */
export function touchNote(noteId: string, edited = false): void {
  void supabase.rpc('note_touch', { p_note: noteId, p_edited: edited }).then(() => undefined)
}
