import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import type { Extensions } from '@tiptap/core'
import type * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import { NoteImage } from './media/note-image'
import { CommentHighlights } from './comments/CommentHighlights'
import { LineHeight } from './extensions/line-height'
import { Pagination } from './extensions/pagination'
import { NoteFile } from './media/note-file'
import { NoteDrawing } from './drawing/note-drawing'
import { NoteDate, noteMention, type MentionSource } from './mentions/mention-extensions'

export interface CollabOptions {
  doc: Y.Doc
  awareness: Awareness
  user: { name: string; color: string }
}

/**
 * The schema every note is written and read in. The live editor, the history
 * preview, the PDF export and the converter that turns an old note into a
 * live one all use THIS list, so a note can never render differently in one
 * of them.
 *
 * With collaboration on, undo/redo comes from Yjs (it only undoes YOUR
 * changes, never a classmate's), so StarterKit's own history is switched off.
 */
export function noteExtensions(opts: { placeholder?: string; collab?: CollabOptions; mentions?: MentionSource } = {}): Extensions {
  const exts: Extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true },
      ...(opts.collab ? { undoRedo: false } : {}),
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextStyle,
    Color,
    FontSize,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    NoteImage,
    NoteFile,
    NoteDrawing,
    NoteDate,
    noteMention(opts.mentions),
    LineHeight,
    Pagination,
  ]
  if (opts.placeholder) exts.push(Placeholder.configure({ placeholder: opts.placeholder }))
  if (opts.collab) {
    const { doc, awareness, user } = opts.collab
    exts.push(
      Collaboration.configure({ document: doc }),
      CollaborationCaret.configure({ provider: { awareness }, user, render: renderCaret }),
      CommentHighlights,
    )
  }
  return exts
}

/** The blinking cursor of someone else, in their colour, with their name above it. */
function renderCaret(user: Record<string, unknown>): HTMLElement {
  const caret = document.createElement('span')
  caret.className = 'ct-caret-remote'
  caret.style.borderColor = String(user.color)
  const label = document.createElement('span')
  label.className = 'ct-caret-label'
  label.style.backgroundColor = String(user.color)
  label.textContent = String(user.name ?? 'Someone')
  caret.appendChild(label)
  return caret
}

/** One colour per person, the same on every screen, picked from their id. */
const CARET_COLORS = ['#e5484d', '#f76b15', '#d6a100', '#30a46c', '#12a594', '#0090ff', '#3e63dd', '#8e4ec6', '#d6409f', '#ab6400']
export function personColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CARET_COLORS[h % CARET_COLORS.length]
}

/** Text colours: a palette like a word processor's, plus any hex. */
export const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#efefef', '#ffffff',
  '#e5484d', '#f76b15', '#d6a100', '#30a46c', '#12a594', '#0090ff', '#3e63dd', '#8e4ec6', '#d6409f', '#ab6400',
  '#ffccc7', '#ffe0c2', '#fff3b0', '#d3f9d8', '#c3fae8', '#d0ebff', '#dbe4ff', '#eebefa', '#fcc2d7', '#e9d8a6',
]

/** Highlighter colours, translucent so the text under them keeps its contrast. */
export const HIGHLIGHTS = [
  'rgba(255, 214, 10, 0.38)', 'rgba(48, 164, 108, 0.32)', 'rgba(0, 144, 255, 0.28)',
  'rgba(214, 64, 159, 0.30)', 'rgba(247, 107, 21, 0.32)', 'rgba(142, 78, 198, 0.30)',
]

/** Fonts: the app's own, safe system faces, and a few loaded on demand. */
export const FONTS = [
  { label: 'Inter', value: null, css: 'Inter' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif', css: 'Arial' },
  { label: 'Georgia', value: 'Georgia, serif', css: 'Georgia' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif', css: 'Times New Roman' },
  { label: 'Lora', value: 'Lora, Georgia, serif', css: 'Lora', google: 'Lora:ital,wght@0,400;0,700;1,400' },
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif', css: 'Merriweather', google: 'Merriweather:ital,wght@0,400;0,700;1,400' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif', css: 'Playfair Display', google: 'Playfair+Display:ital,wght@0,400;0,700;1,400' },
  { label: 'Roboto Mono', value: '"Roboto Mono", ui-monospace, monospace', css: 'Roboto Mono', google: 'Roboto+Mono:wght@400;700' },
  { label: 'Caveat', value: 'Caveat, cursive', css: 'Caveat', google: 'Caveat:wght@400;700' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace', css: 'Courier New' },
] as const

let fontsLoaded = false
/** The Google fonts load once, the first time a note opens — never on other pages. */
export function loadNoteFonts() {
  if (fontsLoaded || typeof document === 'undefined') return
  fontsLoaded = true
  const families = FONTS.filter((f) => 'google' in f).map((f) => `family=${(f as { google: string }).google}`).join('&')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
  document.head.appendChild(link)
}

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]
export const DEFAULT_FONT_SIZE = 16
export const ZOOMS = [50, 75, 90, 100, 110, 125, 150, 200]
