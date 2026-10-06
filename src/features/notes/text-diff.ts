/**
 * What changed between two versions of a note, as text: lines first, then
 * the words inside a line that changed, so a one-word edit shows as one word
 * rather than as a whole paragraph deleted and re-added.
 *
 * Pure (no imports) so Node can test it.
 */
export type Seg = { type: 'same' | 'add' | 'del'; text: string }

interface JsonNode { type?: string; text?: string; content?: JsonNode[]; attrs?: Record<string, unknown> }

const BLOCKS = new Set(['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'taskItem', 'horizontalRule'])

/** A note's text, one block per line. Images, files and drawings are named so adding one counts as a change. */
export function docText(doc: unknown): string {
  const lines: string[] = []
  let cur = ''
  const walk = (n: JsonNode) => {
    if (n.type === 'text') cur += n.text ?? ''
    else if (n.type === 'hardBreak') cur += ' '
    else if (n.type === 'mention') cur += `@${String(n.attrs?.label ?? '')}`
    else if (n.type === 'noteDate') {
      const d = new Date(String(n.attrs?.iso ?? ''))
      cur += Number.isFinite(d.getTime()) ? `[${d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}]` : '[Date]'
    }
    else if (n.type === 'image') lines.push('[Image]')
    else if (n.type === 'noteFile') lines.push(`[File: ${String(n.attrs?.name ?? '')}]`)
    else if (n.type === 'noteDrawing') lines.push('[Drawing]')
    for (const c of n.content ?? []) walk(c)
    if (n.type && BLOCKS.has(n.type) && n.type !== 'listItem' && n.type !== 'taskItem') {
      if (cur.trim()) lines.push(cur.trim())
      cur = ''
    }
  }
  walk((doc ?? {}) as JsonNode)
  if (cur.trim()) lines.push(cur.trim())
  return lines.join('\n')
}

/** Longest common subsequence alignment of two token lists. */
function align(a: string[], b: string[]): Seg[] {
  const n = a.length
  const m = b.length
  // Too big to align cell by cell: report it as a replacement rather than hang.
  if (n * m > 2_000_000) return [...a.map((t) => ({ type: 'del' as const, text: t })), ...b.map((t) => ({ type: 'add' as const, text: t }))]
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: Seg[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: 'del', text: a[i++] })
    else out.push({ type: 'add', text: b[j++] })
  }
  while (i < n) out.push({ type: 'del', text: a[i++] })
  while (j < m) out.push({ type: 'add', text: b[j++] })
  return out
}

function merge(segs: Seg[]): Seg[] {
  const out: Seg[] = []
  for (const s of segs) {
    const last = out[out.length - 1]
    if (last && last.type === s.type) last.text += s.text
    else out.push({ ...s })
  }
  return out
}

/** The changes from `before` to `after`, as runs of unchanged, added and removed text. */
export function diffText(before: string, after: string): Seg[] {
  const lines = align(before.split('\n'), after.split('\n'))
  const out: Seg[] = []
  for (let k = 0; k < lines.length; k++) {
    const s = lines[k]
    const next = lines[k + 1]
    // A removed line followed by an added one is an EDITED line: diff its words.
    if (s.type === 'del' && next?.type === 'add') {
      const words = align(s.text.split(/(\s+)/), next.text.split(/(\s+)/))
      out.push(...words, { type: 'same', text: '\n' })
      k++
      continue
    }
    out.push({ type: s.type, text: `${s.text}\n` })
  }
  return merge(out)
}

/** "+12 −3 words": a short summary for the list. */
export function diffSummary(segs: Seg[]): { added: number; removed: number } {
  const count = (t: string) => t.split(/\s+/).filter(Boolean).length
  return {
    added: segs.filter((s) => s.type === 'add').reduce((n, s) => n + count(s.text), 0),
    removed: segs.filter((s) => s.type === 'del').reduce((n, s) => n + count(s.text), 0),
  }
}
