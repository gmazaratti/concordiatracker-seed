import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { DrawingView } from './DrawingView'
import { MIN_HEIGHT } from './drawing-model'

/** A handwritten block: vector strokes stored on the node (see drawing-model). */
export const NoteDrawing = Node.create({
  name: 'noteDrawing',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      strokes: { default: [], rendered: false },
      height: { default: MIN_HEIGHT * 1.5, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-note-drawing]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-note-drawing': '' }), 'Drawing']
  },
  addNodeView() {
    return ReactNodeViewRenderer(DrawingView)
  },
})
