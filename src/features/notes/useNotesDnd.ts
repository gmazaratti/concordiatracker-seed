import { useCallback, useState } from 'react'
import { canMoveInto, type TreeFolder } from './folder-tree'
import type { DropMode } from './FolderCard'

type Dragged = { kind: 'folder' | 'note'; id: string }

/**
 * Drag and drop for the notes grid.
 *
 * A folder dropped on the MIDDLE of another folder goes inside it (that is
 * how a class goes into a folder); dropped near a card's left or right edge it
 * moves beside it instead. A note dropped on a folder moves into it. The
 * breadcrumb takes drops too, so something can be moved back up a level.
 *
 * Mouse and pen only, like the rest of the app's dragging: on a touchscreen
 * the same gesture is scrolling.
 */
export function useNotesDnd({
  folders,
  onMoveFolder,
  onMoveNote,
  onReorder,
}: {
  folders: TreeFolder[]
  onMoveFolder: (id: string, parentId: string | null) => void
  onMoveNote: (id: string, folderId: string | null) => void
  onReorder: (id: string, beforeId: string | null, afterId: string | null) => void
}) {
  const [dragged, setDragged] = useState<Dragged | null>(null)
  const [hover, setHover] = useState<{ id: string; mode: DropMode } | null>(null)

  const end = useCallback(() => {
    setDragged(null)
    setHover(null)
  }, [])

  const dragProps = (kind: Dragged['kind'], id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/ct-notes', JSON.stringify({ kind, id }))
      setDragged({ kind, id })
    },
    onDragEnd: end,
  })

  /** A folder card (or the "General" card, with id null) as a drop target. */
  const dropProps = (targetId: string | null, opts: { reorderable: boolean }) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragged) return
      let mode: DropMode = null
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const rel = (e.clientX - r.left) / r.width
      if (dragged.kind === 'note') mode = 'into'
      else if (dragged.id === targetId) mode = null
      else if (opts.reorderable && targetId && (rel < 0.22 || rel > 0.78)) mode = rel < 0.5 ? 'before' : 'after'
      else if (canMoveInto(folders, dragged.id, targetId)) mode = 'into'
      if (!mode) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const key = targetId ?? 'general'
      if (hover?.id !== key || hover.mode !== mode) setHover({ id: key, mode })
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setHover(null)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const mode = hover?.mode
      const d = dragged
      end()
      if (!d || !mode) return
      if (mode === 'into') {
        if (d.kind === 'note') onMoveNote(d.id, targetId)
        else onMoveFolder(d.id, targetId)
      } else if (targetId) {
        onReorder(d.id, mode === 'before' ? targetId : null, mode === 'after' ? targetId : null)
      }
    },
  })

  const modeFor = (targetId: string | null): DropMode => (hover?.id === (targetId ?? 'general') ? hover.mode : null)

  return { dragged, dragProps, dropProps, modeFor }
}
