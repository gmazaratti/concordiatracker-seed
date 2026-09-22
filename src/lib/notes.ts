import { supabase } from './supabase'

/**
 * Activity notes — the row of bubbles above the conversation list.
 *
 * Every rule lives in `db/user_notes.sql`: a note is at most 60 characters,
 * it expires after 24 hours, and it reaches the people you are connected to
 * and nobody else. This file is a typed way to ask. It is not the guard.
 */

export interface Note {
  user_id: string
  handle: string
  name: string | null
  avatar_url: string | null
  body: string
  created_at: string
  is_mine: boolean
}

export const NOTE_MAX = 60

/**
 * The suggestions, and why these ones.
 *
 * A blank box is the reason status features die: nobody has anything to say
 * on demand. These are the five answers a classmate actually wants, so the
 * common case is one tap. Writing your own is still right there.
 */
export const NOTE_SUGGESTIONS = [
  'At the library',
  'In class',
  'Studying',
  'Free after 3',
  'On campus',
  'Heads down, back later',
] as const

export async function listNotes(): Promise<Note[]> {
  const { data, error } = await supabase.rpc('notes_feed')
  // An empty row is the right failure: the panel below it is the point of the
  // screen, and it must not be held up by a decoration.
  if (error) return []
  return (data as Note[]) ?? []
}

/** Write or replace yours. Re-posting restarts the 24 hours. */
export async function setNote(body: string): Promise<string | null> {
  const { error } = await supabase.rpc('set_my_note', { p_body: body })
  return error ? error.message : null
}

export async function clearNote(): Promise<void> {
  await supabase.rpc('clear_my_note')
}

/** "3h left" — a note's whole point is that it is from today. */
export function noteAge(createdAt: string, now: number): string {
  const left = 24 * 3_600_000 - (now - new Date(createdAt).getTime())
  if (left <= 0) return 'gone'
  const h = Math.floor(left / 3_600_000)
  if (h >= 1) return `${h}h left`
  return `${Math.max(1, Math.floor(left / 60_000))}m left`
}
