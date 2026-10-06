import type { JSONContent } from '@tiptap/react'
import type { NoteTemplate } from './types'

/** Small builders so the templates read as outlines, not as JSON. */
const h = (level: 1 | 2 | 3, text: string): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
})
const p = (text = ''): JSONContent => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' })
const bullets = (...items: string[]): JSONContent => ({
  type: 'bulletList',
  content: items.map((t) => ({ type: 'listItem', content: [p(t)] })),
})
const tasks = (...items: string[]): JSONContent => ({
  type: 'taskList',
  content: items.map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(t)] })),
})
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

/**
 * The three templates every student gets. Deliberately short: a template is a
 * set of headings to fill in, and one that runs to a page is a form nobody
 * finishes. Placeholder lines are empty bullets, not instructions — text you
 * have to delete before writing is friction on every single note.
 */
export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'builtin:lecture',
    name: 'Lecture notes',
    builtIn: true,
    content: doc(
      h(2, 'Key ideas'),
      bullets(''),
      h(2, 'Notes'),
      p(),
      h(2, 'Questions to follow up'),
      tasks(''),
      h(2, 'Summary'),
      p(),
    ),
  },
  {
    id: 'builtin:reading',
    name: 'Reading notes',
    builtIn: true,
    content: doc(
      h(2, 'Source'),
      p(),
      h(2, 'Main argument'),
      p(),
      h(2, 'Key points'),
      bullets(''),
      h(2, 'Quotes worth keeping'),
      bullets(''),
      h(2, 'What I think'),
      p(),
    ),
  },
  {
    id: 'builtin:exam',
    name: 'Exam review',
    builtIn: true,
    content: doc(
      h(2, 'What the exam covers'),
      bullets(''),
      h(2, 'Formulas and definitions'),
      bullets(''),
      h(2, 'Practice problems'),
      tasks(''),
      h(2, 'Weak spots'),
      bullets(''),
    ),
  },
]
