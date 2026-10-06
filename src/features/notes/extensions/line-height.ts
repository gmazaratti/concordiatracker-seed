import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockLineHeight: {
      /** Line spacing for the highlighted blocks, or the whole note when nothing is highlighted. */
      setBlockLineHeight: (value: string | null) => ReturnType
    }
  }
}

const TYPES = ['paragraph', 'heading']

/** The spacings a word processor offers; anything else is typed in as a number. */
export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2', '2.5']

export function cleanLineHeight(v: string | null | undefined): string | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0.8 && n <= 4 ? String(Math.round(n * 100) / 100) : null
}

/**
 * Line spacing, stored on each paragraph and heading.
 *
 * With text highlighted it changes the blocks the highlight touches; with
 * nothing highlighted it changes every block in the note, which is what
 * "set the spacing for the document" means in a word processor.
 */
export const LineHeight = Extension.create({
  name: 'blockLineHeight',
  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => cleanLineHeight(el.style.lineHeight),
            renderHTML: (attrs) => {
              const v = cleanLineHeight(attrs.lineHeight as string | null)
              return v ? { style: `line-height: ${v}` } : {}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setBlockLineHeight:
        (value) =>
        ({ tr, state, dispatch }) => {
          const v = cleanLineHeight(value)
          const { from, to, empty } = state.selection
          const start = empty ? 0 : from
          const end = empty ? state.doc.content.size : to
          state.doc.nodesBetween(start, end, (node, pos) => {
            if (TYPES.includes(node.type.name)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: v })
          })
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },
})
