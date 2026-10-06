import { useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { PenTool, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DrawingEditor } from './DrawingEditor'
import { takeDrawingOpen, MAX_HEIGHT, MIN_HEIGHT, readStrokes, strokePath, WIDTH } from './drawing-model'

/** A drawing on the page; double-click (or Draw) to open it for drawing. */
export function DrawingView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const strokes = readStrokes(node.attrs.strokes)
  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number(node.attrs.height) || MIN_HEIGHT))
  const [editing, setEditing] = useState(() => takeDrawingOpen() && editor.isEditable)
  const canEdit = editor.isEditable

  return (
    <NodeViewWrapper className="my-3" data-drag-handle>
      <div contentEditable={false} onDoubleClick={() => canEdit && setEditing(true)}
        className={cn('group relative overflow-hidden rounded-xl border border-border bg-white', selected && 'outline-2 outline-offset-2 outline-accent')}>
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="block w-full" role="img" aria-label={strokes.length ? 'Drawing' : 'Empty drawing'}>
          {strokes.map((s, i) => (
            <path key={i} d={strokePath(s)} fill="none" stroke={s.c} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={s.t === 'hl' ? 0.35 : 1} />
          ))}
        </svg>
        {!strokes.length && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-neutral-400">Empty drawing</span>
        )}
        {canEdit && (
          <div className={cn('ct-tips absolute top-2 right-2 flex gap-1 rounded-lg border border-border bg-surface p-0.5 shadow-md transition-opacity duration-150',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-fg hover:bg-surface-2">
              <PenTool size={13} aria-hidden /> Draw
            </button>
            <button type="button" aria-label="Remove drawing" onClick={() => deleteNode()} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-danger/10 hover:text-danger">
              <Trash2 size={13} aria-hidden />
            </button>
          </div>
        )}
      </div>
      {editing && (
        <DrawingEditor initial={strokes} initialHeight={height}
          onCancel={() => setEditing(false)}
          onDone={(s, h) => { updateAttributes({ strokes: s, height: h }); setEditing(false) }} />
      )}
    </NodeViewWrapper>
  )
}
