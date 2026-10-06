import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FolderCard } from './FolderCard'
import { NoteCard } from './NoteCard'
import { getFolder, listFolderNotes } from './notes-api'
import { folderRole } from './sharing-api'
import type { NoteFolder, NoteMeta, NoteRole } from './types'

/**
 * A folder someone else shared with me. Read through the same rules as
 * everything else (the database only returns what the share reaches), and
 * without dragging or menus — filing belongs to the owner.
 */
export function SharedFolderView({ folderId }: { folderId: string }) {
  const navigate = useNavigate()
  const [state, setState] = useState<{ folder: NoteFolder | null; subfolders: NoteFolder[]; notes: NoteMeta[]; role: NoteRole | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [folder, role, notes, subs] = await Promise.all([
        getFolder(folderId),
        folderRole(folderId),
        listFolderNotes(folderId).catch(() => [] as NoteMeta[]),
        supabase.from('note_folders').select('id,name,parent_id,position,course_id,icon,color,pinned').eq('parent_id', folderId),
      ])
      if (cancelled) return
      const subfolders = ((subs.data ?? []) as { id: string; name: string; parent_id: string | null; position: number; course_id: string | null; icon: string; color: string; pinned: boolean }[]).map((f) => ({
        id: f.id, name: f.name, parentId: f.parent_id, position: f.position, courseId: f.course_id, icon: f.icon, color: f.color, pinned: f.pinned,
      }))
      setState({ folder, subfolders, notes, role })
    })()
    return () => {
      cancelled = true
    }
  }, [folderId])

  if (!state) return <div className="mx-auto max-w-6xl px-10 pt-10"><div className="ct-shimmer h-40 rounded-2xl" /></div>
  if (!state.folder || !state.role) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
        <Lock size={26} className="text-subtle" aria-hidden />
        <p className="text-[15px] font-semibold text-fg">You do not have access to this folder</p>
        <p className="text-[13.5px] text-muted">Ask its owner to share it with you.</p>
        <Link to="/app/notes" className="mt-2 text-[13.5px] font-medium text-accent hover:underline">Back to Notes</Link>
      </div>
    )
  }

  return (
    <div className="ct-notes-in mx-auto w-full max-w-6xl px-6 pt-6 pb-16 lg:px-10">
      <nav className="flex items-center gap-1 text-[13px] text-subtle">
        <Link to="/app/notes" className="hover:text-fg">Notes</Link>
        <ChevronRight size={13} aria-hidden />
        <span>Shared with me</span>
      </nav>
      <h1 className="mt-1 font-display text-[30px] font-semibold text-fg">{state.folder.name}</h1>
      <p className="text-[13px] text-muted">{state.role === 'editor' ? 'You can edit the notes in this folder.' : 'You can view this folder.'}</p>
      {state.subfolders.length > 0 && (
        <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
          {state.subfolders.map((f) => (
            <div key={f.id} className="h-40">
              <FolderCard name={f.name} icon={f.icon} color={f.color} count={0} updatedAt={null} drop={null} onOpen={() => navigate(`/app/notes/f/${f.id}`)} />
            </div>
          ))}
        </div>
      )}
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        {state.notes.map((n) => (
          <div key={n.id} className="h-48">
            <NoteCard note={n} onOpen={() => navigate(`/app/notes/n/${n.id}`)} />
          </div>
        ))}
      </div>
      {state.notes.length === 0 && state.subfolders.length === 0 && <p className="mt-8 text-[14px] text-muted">This folder is empty.</p>}
    </div>
  )
}
