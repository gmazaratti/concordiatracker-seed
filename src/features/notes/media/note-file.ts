import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { FileView } from './NoteFileView'

/**
 * A file or a voice note in a note. Like an image, the node keeps the storage
 * PATH (private bucket) and the view resolves a short-lived link, so the file
 * keeps working after any one link has expired.
 */
export const NoteFile = Node.create({
  name: 'noteFile',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      path: { default: null, rendered: false },
      name: { default: 'File', rendered: false },
      size: { default: 0, rendered: false },
      mime: { default: '', rendered: false },
      /** Length of a voice note, in ms (known when it was recorded here). */
      durationMs: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-note-file]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-note-file': '' }), String(node.attrs.name)]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FileView)
  },
})
