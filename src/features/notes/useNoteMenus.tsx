import { useState } from 'react'
import { ArrowUpToLine, FolderInput, FolderOpen, Palette, Pin, PinOff, Share2, Trash2 } from 'lucide-react'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { FolderDialog } from './FolderDialog'
import { ShareDialog } from './ShareDialog'
import type { NotesData } from './useNotesData'
import type { NoteFolder, NoteMeta } from './types'

type Dialog =
  | { kind: 'folder-edit'; folder: NoteFolder; name: string }
  | { kind: 'share'; target: 'note' | 'folder'; id: string; name: string }
  | { kind: 'delete-folder'; folder: NoteFolder; name: string }

/**
 * The right-click menus for folders and notes, and the dialogs they open.
 * One place, so the grid and the cards only say "open the menu here".
 */
export function useNoteMenus(data: NotesData, open: { folder: (id: string) => void; note: (id: string) => void }) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[]; label: string } | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const folderMenu = (e: React.MouseEvent, folder: NoteFolder, name: string) => {
    e.preventDefault()
    const items: MenuItem[] = [
      { id: 'open', label: 'Open', icon: FolderOpen, onSelect: () => open.folder(folder.id) },
      { id: 'edit', label: folder.courseId ? 'Change icon' : 'Rename and style', icon: Palette, onSelect: () => setDialog({ kind: 'folder-edit', folder, name }) },
      { id: 'pin', label: folder.pinned ? 'Unpin' : 'Pin to top', icon: folder.pinned ? PinOff : Pin, onSelect: () => void data.patchFolder(folder.id, { pinned: !folder.pinned }) },
      { id: 'share', label: 'Share…', icon: Share2, onSelect: () => setDialog({ kind: 'share', target: 'folder', id: folder.id, name }) },
    ]
    if (folder.parentId) {
      items.push({ id: 'up', label: 'Move to top level', icon: ArrowUpToLine, onSelect: () => void data.patchFolder(folder.id, { parentId: null }) })
    }
    if (!folder.courseId) {
      items.push({ id: 'delete', label: 'Delete folder', icon: Trash2, danger: true, separated: true, onSelect: () => setDialog({ kind: 'delete-folder', folder, name }) })
    }
    setMenu({ x: e.clientX, y: e.clientY, items, label: `${name} options` })
  }

  const noteMenu = (e: React.MouseEvent, note: NoteMeta, mine: boolean) => {
    e.preventDefault()
    const name = note.title || 'Untitled note'
    const items: MenuItem[] = [{ id: 'open', label: 'Open', icon: FolderOpen, onSelect: () => open.note(note.id) }]
    if (mine) {
      items.push(
        { id: 'pin', label: note.pinned ? 'Unpin' : 'Pin to top', icon: note.pinned ? PinOff : Pin, onSelect: () => void data.patchNote(note.id, { pinned: !note.pinned }) },
        { id: 'share', label: 'Share…', icon: Share2, onSelect: () => setDialog({ kind: 'share', target: 'note', id: note.id, name }) },
      )
      if (note.folderId) {
        items.push({ id: 'general', label: 'Move to General', icon: FolderInput, onSelect: () => void data.patchNote(note.id, { folderId: null }) })
      }
      items.push({ id: 'trash', label: 'Move to trash', icon: Trash2, danger: true, separated: true, onSelect: () => void data.trash(note.id) })
    }
    setMenu({ x: e.clientX, y: e.clientY, items, label: `${name} options` })
  }

  const layer = (
    <>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} label={menu.label} onClose={() => setMenu(null)} />}
      {dialog?.kind === 'folder-edit' && (
        <FolderDialog
          title={dialog.folder.courseId ? 'Class icon' : 'Edit folder'}
          initial={{ name: dialog.name, icon: dialog.folder.icon, color: dialog.folder.color }}
          isClass={!!dialog.folder.courseId}
          onClose={() => setDialog(null)}
          onSave={(v) => {
            void data.patchFolder(dialog.folder.id, dialog.folder.courseId ? { icon: v.icon } : v)
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'share' && <ShareDialog kind={dialog.target} id={dialog.id} name={dialog.name} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'delete-folder' && (
        <ModalShell label="Delete folder" onClose={() => setDialog(null)}>
          <div className="flex flex-col gap-3 p-5">
            <h2 className="text-[16px] font-semibold text-fg">Delete “{dialog.name}”?</h2>
            <p className="text-[13.5px] text-muted">
              The folder goes away. Its notes are kept and move to General, and folders inside it move up to the top.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void data.removeFolder(dialog.folder.id)
                  setDialog(null)
                }}
              >
                Delete folder
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )

  return { folderMenu, noteMenu, layer, openShare: (target: 'note' | 'folder', id: string, name: string) => setDialog({ kind: 'share', target, id, name }) }
}
