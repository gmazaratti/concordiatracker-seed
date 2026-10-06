import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { reportWriteError, writeErrorText } from '@/lib/write-errors'
import { fromB64, toB64 } from './b64'

/**
 * Live co-editing for one note, over our own database and realtime — no
 * extra server.
 *
 *   load:  the snapshot (notes.ydoc) + every logged update after it.
 *   type:  local changes are broadcast on the private channel `noted:<id>`
 *          and, batched, appended to note_doc_updates.
 *
 * COST: Supabase bills Realtime by the message. Broadcasting every keystroke and
 * every cursor move — even with nobody else in the note — made one student
 * taking notes for an hour thousands of messages. So nothing is broadcast while
 * you are alone (the database log is the record, and a newcomer's 'sync'
 * fetches whatever they lack), and with company, changes and cursor moves are
 * merged and sent at most ten times a second.
 *   room:  names, cursors and comment pings travel on `note:<id>`.
 *   join:  a newcomer asks the room for what it is missing ('sync' with its
 *          state vector); anyone there answers with just the difference.
 *
 * Yjs merges any set of updates, in any order, to the same document, so two
 * people typing at once both keep their words and nothing waits on a lock.
 * Only owners and editors can send document updates, enforced per TOPIC: Realtime
 * checks a channel's policies once, at join, before any event name exists, so a
 * rule on the event refuses everyone. Viewers join `noted:` read-only and the
 * server drops their sends. Policies in db/notes_collab.sql.
 */
const DB = 'db'
const REMOTE = 'remote'
const FLUSH_MS = 800
const COMPACT_AFTER = 60
/** How often live changes go out when someone else is in the note. */
const SEND_MS = 100
/** After a newcomer asks to sync, treat the note as shared for this long, even
 *  before their cursor arrives, so nothing typed in between is withheld. */
const PEER_GRACE_MS = 15_000

export type SaveStatus = 'saved' | 'saving' | 'error'

export class NoteProvider {
  readonly doc: Y.Doc
  readonly awareness: Awareness
  private channel: RealtimeChannel | null = null
  private docChannel: RealtimeChannel | null = null
  private pending: Uint8Array[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private lastId = 0
  private rows = 0
  private outbox: Uint8Array[] = []
  private sendTimer: ReturnType<typeof setTimeout> | null = null
  private awTimer: ReturnType<typeof setTimeout> | null = null
  private peerHintAt = 0
  private destroyed = false
  private readonly noteId: string
  private readonly canEdit: boolean
  private statusListeners = new Set<(s: SaveStatus) => void>()
  private commentListeners = new Set<() => void>()
  status: SaveStatus = 'saved'

  constructor(noteId: string, canEdit: boolean) {
    this.noteId = noteId
    this.canEdit = canEdit
    this.doc = new Y.Doc()
    this.awareness = new Awareness(this.doc)
    this.doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
  }

  /** Load what the database holds. Returns false when there is nothing yet. */
  async load(): Promise<boolean> {
    const [snap, updates] = await Promise.all([
      supabase.from('notes').select('ydoc, ydoc_upto').eq('id', this.noteId).maybeSingle(),
      supabase.from('note_doc_updates').select('id, data').eq('note_id', this.noteId).order('id'),
    ])
    const s = snap.data as { ydoc: string | null; ydoc_upto: number } | null
    if (s?.ydoc) Y.applyUpdate(this.doc, fromB64(s.ydoc), DB)
    this.lastId = s?.ydoc_upto ?? 0
    const list = (updates.data ?? []) as { id: number; data: string }[]
    for (const u of list) {
      if (u.id <= this.lastId) continue
      Y.applyUpdate(this.doc, fromB64(u.data), DB)
      this.lastId = Math.max(this.lastId, u.id)
    }
    this.rows = list.length
    return !!s?.ydoc || list.length > 0
  }

  /** Store a first state built from a note written before co-editing.
   *  Returns false if someone else seeded it first — then load theirs. */
  async seed(state: Uint8Array): Promise<boolean> {
    const { data, error } = await supabase.rpc('note_seed_ydoc', { p_note: this.noteId, p_state: toB64(state) })
    if (error || !data) return false
    Y.applyUpdate(this.doc, state, DB)
    return true
  }

  /** Join the room. Call after load (and seed). */
  async connect() {
    // A remount (StrictMode, a quick back-and-forth) can leave the previous
    // copy's channels still leaving, and supabase.channel() hands an existing
    // topic back rather than making a new one.
    for (const old of supabase.realtime.getChannels()) {
      if (old.topic === `realtime:note:${this.noteId}` || old.topic === `realtime:noted:${this.noteId}`) await supabase.removeChannel(old)
    }
    if (this.destroyed) return
    const opts = { config: { private: true, broadcast: { self: false } } }
    const doc = supabase.channel(`noted:${this.noteId}`, opts)
    doc.on('broadcast', { event: 'y' }, ({ payload }) => {
      Y.applyUpdate(this.doc, fromB64((payload as { u: string }).u), REMOTE)
    })
    const room = supabase.channel(`note:${this.noteId}`, opts)
    room.on('broadcast', { event: 'aw' }, ({ payload }) => {
      const hadPeers = this.hasPeers()
      applyAwarenessUpdate(this.awareness, fromB64((payload as { a: string }).a), REMOTE)
      // Someone just appeared: they need my cursor, which I stopped sending
      // while I was alone.
      if (!hadPeers && this.hasPeers()) this.sendAwareness([this.doc.clientID])
    })
    room.on('broadcast', { event: 'cm' }, () => this.commentListeners.forEach((l) => l()))
    room.on('broadcast', { event: 'sync' }, ({ payload }) => {
      // Someone arrived: send them what they lack, and who is here.
      this.peerHintAt = Date.now()
      if (this.canEdit) {
        const diff = Y.encodeStateAsUpdate(this.doc, fromB64((payload as { sv: string }).sv))
        if (diff.length > 2) void doc.send({ type: 'broadcast', event: 'y', payload: { u: toB64(diff) } })
      }
      this.sendAwareness([this.doc.clientID])
    })
    this.docChannel = doc
    this.channel = room
    window.addEventListener('pagehide', this.onLeave)
    // Ask for the difference only once both are joined, so the answer on
    // `noted:` cannot arrive before we are listening there.
    let joined = 0
    const ready = (status: string) => {
      if (status !== 'SUBSCRIBED' || this.destroyed || ++joined < 2) return
      void room.send({ type: 'broadcast', event: 'sync', payload: { sv: toB64(Y.encodeStateVector(this.doc)) } })
      this.sendAwareness([this.doc.clientID])
    }
    doc.subscribe(ready)
    room.subscribe(ready)
    if (this.canEdit && this.rows > COMPACT_AFTER) void this.compact()
  }

  /** Is anybody else in this note right now (or did someone just ask to join)? */
  private hasPeers(): boolean {
    if (Date.now() - this.peerHintAt < PEER_GRACE_MS) return true
    for (const id of this.awareness.getStates().keys()) if (id !== this.doc.clientID) return true
    return false
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === DB || origin === REMOTE || !this.canEdit) return
    if (this.hasPeers()) {
      this.outbox.push(update)
      if (!this.sendTimer) this.sendTimer = setTimeout(() => this.sendOutbox(), SEND_MS)
    }
    this.pending.push(update)
    this.setStatus('saving')
    if (!this.flushTimer) this.flushTimer = setTimeout(() => void this.flush(), FLUSH_MS)
  }

  /** Closing the tab never unmounts anything, so say goodbye here: the others
   *  drop this cursor at once instead of 30 seconds later, and stop sending. */
  private onLeave = () => {
    this.sendOutbox()
    void this.flush()
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
    this.sendAwareness([this.doc.clientID])
  }

  private sendOutbox() {
    this.sendTimer = null
    if (this.outbox.length === 0) return
    const merged = Y.mergeUpdates(this.outbox)
    this.outbox = []
    void this.docChannel?.send({ type: 'broadcast', event: 'y', payload: { u: toB64(merged) } })
  }

  private onAwarenessUpdate = (_c: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === REMOTE || !this.hasPeers()) return
    // A cursor moving is many updates a second; the last position is all anyone needs.
    if (!this.awTimer) {
      this.awTimer = setTimeout(() => {
        this.awTimer = null
        this.sendAwareness([this.doc.clientID])
      }, SEND_MS)
    }
  }

  private sendAwareness(clients: number[]) {
    if (!this.channel || clients.length === 0) return
    void this.channel.send({ type: 'broadcast', event: 'aw', payload: { a: toB64(encodeAwarenessUpdate(this.awareness, clients)) } })
  }

  /** Write the batched changes to the log, as one merged update. */
  async flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    if (this.pending.length === 0) return
    const merged = Y.mergeUpdates(this.pending)
    this.pending = []
    const { error } = await supabase.from('note_doc_updates').insert({ note_id: this.noteId, data: toB64(merged) })
    if (error) {
      reportWriteError('Your note did not save', writeErrorText(error))
      this.setStatus('error')
    } else {
      this.rows++
      if (this.pending.length === 0) this.setStatus('saved')
    }
  }

  private setStatus(s: SaveStatus) {
    if (s === this.status) return
    this.status = s
    this.statusListeners.forEach((l) => l(s))
  }

  onStatus(l: (s: SaveStatus) => void) {
    this.statusListeners.add(l)
    return () => void this.statusListeners.delete(l)
  }

  /** Comments changed somewhere: tell everyone else to reload theirs. */
  pingComments() {
    void this.channel?.send({ type: 'broadcast', event: 'cm', payload: {} })
  }

  onComments(l: () => void) {
    this.commentListeners.add(l)
    return () => void this.commentListeners.delete(l)
  }

  private async compact() {
    const upto = this.lastId
    if (!upto) return
    await supabase.rpc('note_compact', { p_note: this.noteId, p_state: toB64(Y.encodeStateAsUpdate(this.doc)), p_upto: upto })
  }

  destroy() {
    this.destroyed = true
    window.removeEventListener('pagehide', this.onLeave)
    if (this.sendTimer) clearTimeout(this.sendTimer)
    if (this.awTimer) clearTimeout(this.awTimer)
    this.sendOutbox()
    void this.flush()
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
    this.sendAwareness([this.doc.clientID])
    this.doc.off('update', this.onDocUpdate)
    this.awareness.off('update', this.onAwarenessUpdate)
    if (this.channel) void supabase.removeChannel(this.channel)
    if (this.docChannel) void supabase.removeChannel(this.docChannel)
    this.awareness.destroy()
    this.doc.destroy()
  }
}
