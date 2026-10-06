import { supabase } from '@/lib/supabase'
import type { NotePerson } from '../sharing-api'
import type { MentionSource } from './mention-extensions'

/**
 * Who "@" can offer in one open note, kept current from outside the editor
 * (the editor is built once; the people the note is shared with change).
 * Mentioning somebody who can open the note notifies them; the database
 * decides whether they may hear about it (note_mention, db/notes_batch3.sql).
 */
export class LiveMentionSource implements MentionSource {
  private list: NotePerson[] = []
  myId: string | null = null
  private readonly noteId: string

  constructor(noteId: string) {
    this.noteId = noteId
  }

  people(): NotePerson[] {
    return this.list
  }

  update(list: NotePerson[], myId: string | null) {
    this.list = list
    this.myId = myId
  }

  onMention(userId: string) {
    supabase.rpc('note_mention', { p_note: this.noteId, p_user: userId }).then(() => {})
  }
}
