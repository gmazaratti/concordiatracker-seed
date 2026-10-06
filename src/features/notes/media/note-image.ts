import { Image } from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageView } from './NoteImageView'

/**
 * An image in a note. The node stores the storage PATH (private bucket); the
 * view turns it into a short-lived link each time it is shown, so a picture
 * keeps working long after any one link would have expired.
 */
export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      path: { default: null },
      size: { default: 'full' },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
}).configure({ inline: false, allowBase64: false })
