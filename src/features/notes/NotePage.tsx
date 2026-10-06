import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useNoteDoc } from './useNoteDoc'
import { useCollab } from './collab/useCollab'
import { NoteWorkspace } from './NoteWorkspace'
import type { Note, NoteRole } from './types'

/** /app/notes/n/:id — loads the note and my role, then the live session. */
export function NotePage({ noteId }: { noteId: string }) {
  const doc = useNoteDoc(noteId)
  if (doc.missing) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
        <Lock size={26} className="text-subtle" aria-hidden />
        <p className="text-[15px] font-semibold text-fg">This note is not available</p>
        <p className="text-[13.5px] text-muted">It may have been deleted, or it is not shared with you.</p>
        <Link to="/app/notes" className="mt-2 text-[13.5px] font-medium text-accent hover:underline">Back to Notes</Link>
      </div>
    )
  }
  if (!doc.note || !doc.role) return <Skeleton />
  return <Live key={noteId} note={doc.note} role={doc.role} doc={doc} />
}

function Live({ note, role, doc }: { note: Note; role: NoteRole; doc: ReturnType<typeof useNoteDoc> }) {
  const canEdit = role === 'owner' || role === 'editor'
  const collab = useCollab(note.id, canEdit, note.content)
  if (collab.failed) {
    return <p className="p-10 text-center text-[14px] text-danger">This note could not be opened for editing. Check your connection and try again.</p>
  }
  if (!collab.provider) return <Skeleton />
  return <NoteWorkspace note={note} role={role} provider={collab.provider} legacy={collab.legacy} people={doc.people} loadPeople={doc.loadPeople} />
}

function Skeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <div className="h-12 border-b border-border" />
      <div className="h-11 border-b border-border" />
      <div className="mx-auto mt-8 h-[70vh] w-full max-w-[816px] ct-shimmer rounded-sm" />
    </div>
  )
}
