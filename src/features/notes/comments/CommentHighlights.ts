import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import * as Y from 'yjs'
import { ySyncPluginKey, relativePositionToAbsolutePosition } from '@tiptap/y-tiptap'

export interface HighlightThread {
  id: string
  anchor: { from: unknown; to: unknown } | null
}

interface Storage {
  threads: HighlightThread[]
  active: string | null
  onSelect: (id: string) => void
}

const key = new PluginKey('ct-comment-highlights')

/**
 * Paints open comment threads onto the text they are about, and opens a
 * thread when its words are clicked. Anchors are Yjs relative positions, so
 * they follow the text through anyone's edits without the document having to
 * carry a mark (which a viewer, who can comment, could not add).
 */
export const CommentHighlights = Extension.create<Record<string, never>, Storage>({
  name: 'commentHighlights',
  addStorage() {
    return { threads: [], active: null, onSelect: () => {} }
  },
  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const sync = ySyncPluginKey.getState(state) as { binding?: { mapping: unknown; type: Y.XmlFragment; doc: Y.Doc } } | undefined
            const binding = sync?.binding
            if (!binding) return null
            const decos: Decoration[] = []
            for (const t of storage.threads) {
              if (!t.anchor) continue
              const from = relativePositionToAbsolutePosition(binding.doc, binding.type, Y.createRelativePositionFromJSON(t.anchor.from), binding.mapping as never)
              const to = relativePositionToAbsolutePosition(binding.doc, binding.type, Y.createRelativePositionFromJSON(t.anchor.to), binding.mapping as never)
              if (from == null || to == null || to <= from) continue
              decos.push(Decoration.inline(from, to, {
                class: t.id === storage.active ? 'ct-comment ct-comment-active' : 'ct-comment',
                'data-thread': t.id,
              }))
            }
            return DecorationSet.create(state.doc, decos)
          },
          handleClick(_view, _pos, event) {
            const el = (event.target as HTMLElement | null)?.closest?.('[data-thread]') as HTMLElement | null
            if (el?.dataset.thread) {
              storage.onSelect(el.dataset.thread)
              return false
            }
            return false
          },
        },
      }),
    ]
  },
})
