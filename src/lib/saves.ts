import { supabase } from './supabase'

/**
 * Saving a post or an event — privately.
 *
 * A SAVE IS NOT A REPOST, and the difference is who learns about it. A repost
 * is a statement: it goes on your profile under your name and the club can
 * count it. A save is a bookmark — nobody is told and there is no count
 * function anywhere, because `saves` is select-own (db/saves.sql). If a
 * "saves" number ever appears on a post, it did not come from here.
 */
export type SaveKind = 'event' | 'post'

/** Returns the new state. */
export async function toggleSave(kind: SaveKind, targetId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_save', {
    p_kind: kind,
    p_target: targetId,
  })
  return !error && data === true
}

/** Which of these have I saved — one call for a screenful, so a feed does not
 *  fire a request per card. */
export async function savedAmong(kind: SaveKind, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase.rpc('my_saved', { p_kind: kind, p_targets: ids })
  if (error || !Array.isArray(data)) return new Set()
  return new Set(data as string[])
}

export interface SavedRow {
  id: string
  kind: SaveKind
  targetId: string
  createdAt: string
}

export async function loadSaved(): Promise<SavedRow[]> {
  const { data, error } = await supabase.rpc('saved_list')
  if (error || !Array.isArray(data)) return []
  return (data as { id: string; target_kind: SaveKind; target_id: string; created_at: string }[]).map(
    (r) => ({ id: r.id, kind: r.target_kind, targetId: r.target_id, createdAt: r.created_at }),
  )
}
