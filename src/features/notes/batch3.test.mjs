// node src/features/notes/batch3.test.mjs
// The pure parts of Notes batch 3: version diffs, study cards, image crop and
// resize maths, and handwriting strokes.
import { diffSummary, diffText, docText } from './text-diff.ts'
import { makeCards, makeGuide, makeQuiz } from './study/study.ts'
import { clampCrop, dragCrop, readCrop, widthFromDrag } from './media/image-geometry.ts'
import { addPoint, hits, readStrokes, strokePath } from './drawing/drawing-model.ts'

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`)
  if (!ok) failed++
}
const p = (text, marks) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] })
const h = (text) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })

console.log('text-diff')
const a = 'Supply and demand\nPrice rises when demand rises'
const b = 'Supply and demand\nPrice falls when demand falls\nNew line'
const segs = diffText(a, b)
check('unchanged line stays the same', segs[0].type === 'same' && segs[0].text.startsWith('Supply'))
check('an edited line diffs its words', segs.some((s) => s.type === 'del' && s.text.includes('rises')) && segs.some((s) => s.type === 'add' && s.text.includes('falls')))
check('the word "Price" is not marked as changed', !segs.some((s) => s.type !== 'same' && s.text.includes('Price')))
const sum = diffSummary(segs)
check('summary counts added and removed words', sum.added === 4 && sum.removed === 2, JSON.stringify(sum))
check('identical text has no changes', diffText('x\ny', 'x\ny').every((s) => s.type === 'same'))
check('a huge rewrite does not hang', diffText('w '.repeat(3000), 'z '.repeat(3000)).length > 0)
check('docText names images, mentions and dates', docText({ type: 'doc', content: [p('Hi'), { type: 'image', attrs: {} }, { type: 'paragraph', content: [{ type: 'mention', attrs: { label: 'Darius' } }] }] }) === 'Hi\n[Image]\n@Darius')

console.log('study')
const doc = { type: 'doc', content: [
  h('Market structures'),
  p('A monopoly has a single seller.'),
  p('Opportunity cost: the next best alternative given up'),
  p('Elasticity - how much demand responds to price'),
  { type: 'paragraph', content: [{ type: 'text', text: 'Inflation', marks: [{ type: 'bold' }] }, { type: 'text', text: ' a rise in the general price level' }] },
  p('Note: see chapter 4'),
  { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p('Read chapter 5')] }] },
] }
const cards = makeCards(doc)
const fronts = cards.map((c) => c.front)
check('a heading becomes a card with the text under it', fronts.includes('Market structures'))
check('"Term: definition" becomes a card', cards.some((c) => c.front === 'Opportunity cost' && c.back.startsWith('the next best')))
check('"Term - definition" becomes a card', fronts.includes('Elasticity'))
check('a line starting in bold becomes a card', cards.some((c) => c.front === 'Inflation' && c.back.startsWith('a rise')))
check('"Note: …" is not a definition', !fronts.includes('Note'))
check('duplicates are not repeated', new Set(fronts.map((f) => f.toLowerCase())).size === fronts.length)
const quiz = makeQuiz(cards, 3)
check('a quiz question per card, four choices each', quiz.length === cards.length && quiz.every((q) => q.choices.length === 4))
check('the right answer is among the choices', quiz.every((q, i) => q.choices[q.answer] === cards[i].front))
check('fewer than four cards make no quiz', makeQuiz(cards.slice(0, 3)).length === 0)
const guide = makeGuide(doc)
check('the guide lists the bold terms under their heading', guide.some((s) => s.heading === 'Market structures' && s.terms.includes('Inflation')))
check('the guide lists unticked checklist items', guide.some((s) => s.todo.includes('Read chapter 5')))

console.log('image geometry')
check('a crop never leaves the picture', JSON.stringify(clampCrop({ x: 0.9, y: -1, w: 0.5, h: 2 })) === JSON.stringify({ x: 0.5, y: 0, w: 0.5, h: 1 }))
check('a crop never shrinks to nothing', dragCrop({ x: 0, y: 0, w: 1, h: 1 }, 'se', -2, -2).w >= 0.05)
check('dragging the top-left corner keeps the bottom-right fixed', (() => { const c = dragCrop({ x: 0, y: 0, w: 1, h: 1 }, 'nw', 0.2, 0.1); return Math.abs(c.x + c.w - 1) < 1e-9 && Math.abs(c.y + c.h - 1) < 1e-9 })())
check('a broken crop reads as none', readCrop({ x: 'a' }) === null && readCrop(null) === null)
check('dragging the right corner out widens the image (both sides)', widthFromDrag(50, 100, 800, 'right') === 75)
check('width is held between 10% and 100%', widthFromDrag(50, 2000, 800, 'right') === 100 && widthFromDrag(50, -2000, 800, 'right') === 10)

console.log('drawing')
check('bad strokes are dropped, good ones kept', readStrokes([{ t: 'pen', c: '#ff0000', w: 3, p: [1, 2, 3, 4] }, { t: 'virus', p: [1, 2] }, { t: 'pen', c: 'red', w: 99, p: [1, 'x'] }]).length === 1)
check('an unsafe colour falls back to black', readStrokes([{ t: 'line', c: 'url(evil)', w: 2, p: [0, 0, 5, 5] }])[0].c === '#111111')
check('a slow pen does not add duplicate points', addPoint([10, 10], 10.5, 10.4).length === 2)
check('the eraser hits a stroke it touches', hits({ t: 'line', c: '#000000', w: 2, p: [0, 0, 100, 0] }, 50, 5))
check('the eraser misses a stroke far away', !hits({ t: 'line', c: '#000000', w: 2, p: [0, 0, 100, 0] }, 50, 60))
check('a rectangle path closes', strokePath({ t: 'rect', c: '#000000', w: 2, p: [0, 0, 10, 10] }).endsWith('Z'))

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nnotes batch 3: all checks passed')
