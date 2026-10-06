import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { MessageSquare, MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Marker { id: string; top: number; count: number }

/**
 * The page's right edge, like Google Docs: with text highlighted, a "+" in a
 * comment bubble appears half on the page, half off it, level with the
 * highlight; and every line that already has a comment shows a bubble there,
 * which opens its thread.
 *
 * (The browser's own right-click menu, with the system's Look Up and Writing
 * Tools, belongs to the operating system: a web page cannot add an item to
 * it, only replace the whole menu. This is the way in instead.)
 */
export function MarginComments({ editor, paper, canComment, onAdd, onOpen, activeId }: {
  editor: Editor
  paper: HTMLElement | null
  canComment: boolean
  onAdd: () => void
  onOpen: (threadId: string) => void
  activeId: string | null
}) {
  const [add, setAdd] = useState<number | null>(null)
  const [markers, setMarkers] = useState<Marker[]>([])

  useEffect(() => {
    if (!paper) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const measure = () => {
      timer = null
      if (editor.isDestroyed) return
      const pr = paper.getBoundingClientRect()
      const scale = paper.offsetHeight > 0 ? pr.height / paper.offsetHeight : 1
      const { from, to, empty } = editor.state.selection
      if (!empty && canComment) {
        try {
          const a = editor.view.coordsAtPos(from)
          const b = editor.view.coordsAtPos(to)
          setAdd(((a.top + b.bottom) / 2 - pr.top) / scale)
        } catch {
          setAdd(null)
        }
      } else {
        setAdd(null)
      }
      const seen = new Map<string, Marker>()
      paper.querySelectorAll<HTMLElement>('.ct-comment[data-thread]').forEach((el) => {
        const id = el.dataset.thread!
        const top = (el.getBoundingClientRect().top - pr.top) / scale
        const m = seen.get(id)
        if (!m || top < m.top) seen.set(id, { id, top, count: 1 })
      })
      // Two comments on one line share a bubble rather than stacking on top of each other.
      const rows: Marker[] = []
      for (const m of [...seen.values()].sort((x, y) => x.top - y.top)) {
        const last = rows[rows.length - 1]
        if (last && Math.abs(last.top - m.top) < 18) last.count += 1
        else rows.push({ ...m })
      }
      setMarkers(rows)
    }
    const schedule = () => { if (!timer) timer = setTimeout(measure, 40) }
    editor.on('transaction', schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(paper)
    schedule()
    return () => {
      editor.off('transaction', schedule)
      ro.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [editor, paper, canComment])

  return (
    <div aria-hidden={false} className="pointer-events-none absolute inset-y-0 right-0 w-0">
      {markers.map((m) => (
        <button key={m.id} type="button" aria-label={m.count > 1 ? `${m.count} comments here` : 'Open comment'}
          onMouseDown={(e) => e.preventDefault()} onClick={() => onOpen(m.id)}
          style={{ top: m.top - 2 }}
          className={cn('pointer-events-auto absolute flex h-7 -translate-x-1/2 items-center gap-0.5 rounded-full border px-1.5 text-[11px] font-semibold shadow-md transition-colors duration-150',
            m.id === activeId ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-surface text-muted hover:text-fg')}>
          <MessageSquare size={13} aria-hidden />{m.count > 1 && m.count}
        </button>
      ))}
      {add !== null && (
        <button type="button" aria-label="Add a comment" onMouseDown={(e) => e.preventDefault()} onClick={onAdd}
          style={{ top: add - 16 }}
          className="ct-animate-pop pointer-events-auto absolute grid size-9 -translate-x-1/2 place-items-center rounded-full bg-accent text-accent-contrast shadow-lg transition-transform duration-150 hover:scale-105">
          <MessageSquarePlus size={17} aria-hidden />
        </button>
      )}
    </div>
  )
}
