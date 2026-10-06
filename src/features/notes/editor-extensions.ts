import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'

/**
 * The schema every note is written and read in. The editor and the read-only
 * history preview both use THIS list, so an old version can never render
 * differently from how it looked when it was written.
 */
export function noteExtensions(placeholder?: string) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextStyle,
    Color,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ]
}

/** Text colours: readable on both the light page and the dark one. */
export const TEXT_COLORS = [
  { label: 'Default', value: null },
  { label: 'Red', value: '#e5484d' },
  { label: 'Orange', value: '#f76b15' },
  { label: 'Amber', value: '#d6a100' },
  { label: 'Green', value: '#30a46c' },
  { label: 'Teal', value: '#12a594' },
  { label: 'Blue', value: '#3e63dd' },
  { label: 'Purple', value: '#8e4ec6' },
  { label: 'Grey', value: '#8b8d98' },
]

/** Highlighter colours, translucent so the text under them keeps its contrast. */
export const HIGHLIGHTS = [
  { label: 'None', value: null },
  { label: 'Yellow', value: 'rgba(255, 214, 10, 0.38)' },
  { label: 'Green', value: 'rgba(48, 164, 108, 0.32)' },
  { label: 'Blue', value: 'rgba(62, 99, 221, 0.32)' },
  { label: 'Pink', value: 'rgba(214, 64, 159, 0.32)' },
  { label: 'Orange', value: 'rgba(247, 107, 21, 0.32)' },
]

export const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40]
export const DEFAULT_FONT_SIZE = 16
export const ZOOMS = [75, 90, 100, 110, 125, 150]
