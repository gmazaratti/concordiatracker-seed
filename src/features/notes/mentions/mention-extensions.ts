import { Node, mergeAttributes, type Editor, type Range } from '@tiptap/core'
import { Mention } from '@tiptap/extension-mention'
import { ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { MentionList, type MentionListHandle } from './MentionList'
import { MentionChip } from './MentionChip'
import { DateChip } from './DateChip'
import { mentionItems, type MentionItem } from './mention-items'
import { armDateChipOpen } from './chip-state'
import type { NotePerson } from '../sharing-api'

export interface MentionSource {
  /** The people this note is shared with, read when "@" is typed. */
  people: () => NotePerson[]
  myId: string | null
  /** Called when someone with access is mentioned, to notify them. */
  onMention: (userId: string) => void
}

/** A date or time in the text. Click it to add it to your calendar. */
export const NoteDate = Node.create({
  name: 'noteDate',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { iso: { default: null, rendered: false } }
  },
  parseHTML() {
    return [{ tag: 'span[data-note-date]', getAttrs: (el) => ({ iso: (el as HTMLElement).getAttribute('data-note-date') }) }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-note-date': node.attrs.iso ?? '' }), node.attrs.iso ? new Date(node.attrs.iso as string).toLocaleString() : 'Date']
  },
  renderText({ node }) {
    return node.attrs.iso ? new Date(node.attrs.iso as string).toLocaleString() : ''
  },
  addNodeView() {
    return ReactNodeViewRenderer(DateChip, { as: 'span' })
  },
})

function roundedNow(): string {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return d.toISOString()
}

function insertItem(editor: Editor, range: Range, item: MentionItem, source?: MentionSource) {
  if (item.kind === 'date') {
    if (!item.iso) armDateChipOpen()
    editor.chain().focus().insertContentAt(range, [{ type: 'noteDate', attrs: { iso: item.iso ?? roundedNow() } }, { type: 'text', text: ' ' }]).run()
    return
  }
  editor.chain().focus().insertContentAt(range, [
    { type: 'mention', attrs: { id: item.userId ?? item.handle, label: item.label, handle: item.handle } },
    { type: 'text', text: ' ' },
  ]).run()
  if (item.userId && item.access) source?.onMention(item.userId)
}

/** The "@" menu, drawn next to the cursor. */
function suggestion(source?: MentionSource) {
  return {
    char: '@',
    allowSpaces: false,
    items: async ({ query }: { query: string }) => (source ? mentionItems(query, source.people(), source.myId) : []),
    command: ({ editor, range, props }: { editor: Editor; range: Range; props: unknown }) => insertItem(editor, range, props as MentionItem, source),
    render: () => {
      let r: ReactRenderer<MentionListHandle> | null = null
      const place = (rect: DOMRect | null | undefined) => {
        const el = r?.element as HTMLElement | undefined
        if (!el || !rect) return
        el.style.position = 'fixed'
        el.style.zIndex = '200'
        const h = el.offsetHeight || 280
        const below = rect.bottom + 6 + h < window.innerHeight
        el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`
        el.style.top = `${below ? rect.bottom + 6 : Math.max(8, rect.top - h - 6)}px`
      }
      const close = () => {
        r?.element.remove()
        r?.destroy()
        r = null
      }
      return {
        onStart: (props: SuggestionProps<MentionItem>) => {
          r = new ReactRenderer(MentionList, { props: { items: props.items, command: props.command }, editor: props.editor })
          document.body.appendChild(r.element)
          place(props.clientRect?.())
        },
        onUpdate: (props: SuggestionProps<MentionItem>) => {
          r?.updateProps({ items: props.items, command: props.command })
          place(props.clientRect?.())
        },
        onKeyDown: ({ event }: SuggestionKeyDownProps) => {
          if (event.key === 'Escape') {
            close()
            return true
          }
          return r?.ref?.onKeyDown(event) ?? false
        },
        onExit: close,
      }
    },
  }
}

/** A person in the text, as a chip that shows their profile when clicked. */
export function noteMention(source?: MentionSource) {
  return Mention.extend({
    addAttributes() {
      return { ...this.parent?.(), handle: { default: null, rendered: false } }
    },
    addNodeView() {
      return ReactNodeViewRenderer(MentionChip, { as: 'span' })
    },
  }).configure({
    suggestion: suggestion(source),
    renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.handle ?? ''}`,
  })
}
