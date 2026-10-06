/**
 * Study tools built from a note itself, no AI involved: the cards are the
 * student's own words, picked out of the shapes notes are already written in.
 *
 *   "Term: definition", "Term - definition", "Term — definition", "Term :: definition"
 *   a line that starts in bold, followed by its explanation
 *   a heading, with the first lines under it as the answer
 *
 * Pure (no imports) so Node can test it.
 */
export interface Card { front: string; back: string }
export interface GuideSection { heading: string; terms: string[]; todo: string[] }
interface JsonNode { type?: string; text?: string; content?: JsonNode[]; marks?: { type: string }[]; attrs?: Record<string, unknown> }

const SEP = /^(.{2,80}?)\s*(?:::|:|\s[-–—]\s)\s*(.{3,})$/
/** Labels that end in a colon without defining anything. */
const NOT_TERMS = /^(note|nb|ps|todo|to do|source|sources|ref|reference|see|ex|e\.g|eg|example|date|time|due|page|pages|q|a|question|answer|reminder|update|edit|url|link|https?)$/i

function textOf(n: JsonNode): string {
  if (n.type === 'text') return n.text ?? ''
  if (n.type === 'mention') return `@${String(n.attrs?.label ?? '')}`
  return (n.content ?? []).map(textOf).join(n.type === 'paragraph' || n.type === 'heading' ? '' : ' ')
}

function leadingBold(n: JsonNode): string | null {
  const first = n.content?.[0]
  if (first?.type === 'text' && first.marks?.some((m) => m.type === 'bold')) return (first.text ?? '').replace(/[:\-–—\s]+$/, '').trim()
  return null
}

/** Paragraph-like blocks in reading order, with headings marked. */
function flatten(doc: JsonNode): { kind: 'heading' | 'p' | 'todo'; node: JsonNode; done?: boolean }[] {
  const out: { kind: 'heading' | 'p' | 'todo'; node: JsonNode; done?: boolean }[] = []
  const walk = (n: JsonNode, todo?: boolean) => {
    if (n.type === 'heading') out.push({ kind: 'heading', node: n })
    else if (n.type === 'paragraph') out.push({ kind: todo !== undefined ? 'todo' : 'p', node: n, done: todo })
    else if (n.type === 'taskItem') for (const c of n.content ?? []) walk(c, !!n.attrs?.checked)
    else for (const c of n.content ?? []) walk(c, todo)
  }
  walk(doc)
  return out
}

export function makeCards(doc: unknown): Card[] {
  const blocks = flatten((doc ?? {}) as JsonNode)
  const cards: Card[] = []
  const seen = new Set<string>()
  const add = (front: string, back: string) => {
    const f = front.trim().replace(/\s+/g, ' ')
    const b = back.trim().replace(/\s+/g, ' ')
    if (f.length < 2 || b.length < 3 || seen.has(f.toLowerCase())) return
    seen.add(f.toLowerCase())
    cards.push({ front: f.slice(0, 140), back: b.slice(0, 600) })
  }
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const text = textOf(b.node).trim()
    if (!text) continue
    if (b.kind === 'heading') {
      const under: string[] = []
      for (let j = i + 1; j < blocks.length && blocks[j].kind !== 'heading' && under.join(' ').length < 240; j++) {
        const t = textOf(blocks[j].node).trim()
        if (t) under.push(t)
      }
      if (under.length) add(text, under.join(' '))
      continue
    }
    const bold = leadingBold(b.node)
    if (bold && text.length > bold.length + 3) {
      add(bold, text.slice(text.indexOf(bold) + bold.length).replace(/^[\s:\-–—]+/, ''))
      continue
    }
    const m = text.match(SEP)
    // "Note: …" and URLs are not definitions.
    if (m && !NOT_TERMS.test(m[1].trim()) && m[1].split(' ').length <= 8) add(m[1], m[2])
  }
  return cards
}

/** Four-choice questions: the definition is asked, the term is the answer. */
export function makeQuiz(cards: Card[], seed = 1): { question: string; choices: string[]; answer: number }[] {
  if (cards.length < 4) return []
  let s = seed
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return cards.map((c, i) => {
    const others = cards.filter((_, j) => j !== i).sort(() => rand() - 0.5).slice(0, 3).map((o) => o.front)
    const choices = [...others]
    const answer = Math.floor(rand() * 4)
    choices.splice(answer, 0, c.front)
    return { question: c.back, choices, answer }
  })
}

/** An outline: each heading with the terms in bold under it and what is still to do. */
export function makeGuide(doc: unknown): GuideSection[] {
  const blocks = flatten((doc ?? {}) as JsonNode)
  const out: GuideSection[] = []
  let cur: GuideSection = { heading: 'Overview', terms: [], todo: [] }
  const boldIn = (n: JsonNode): string[] =>
    (n.content ?? []).flatMap((c) => (c.type === 'text' && c.marks?.some((m) => m.type === 'bold') ? [(c.text ?? '').trim()] : boldIn(c))).filter((t) => t.length > 1)
  for (const b of blocks) {
    if (b.kind === 'heading') {
      if (cur.terms.length || cur.todo.length || cur.heading !== 'Overview') out.push(cur)
      cur = { heading: textOf(b.node).trim() || 'Untitled', terms: [], todo: [] }
    } else if (b.kind === 'todo') {
      if (!b.done && textOf(b.node).trim()) cur.todo.push(textOf(b.node).trim())
    } else {
      for (const t of boldIn(b.node)) if (!cur.terms.includes(t)) cur.terms.push(t)
    }
  }
  if (cur.terms.length || cur.todo.length || cur.heading !== 'Overview') out.push(cur)
  return out
}
