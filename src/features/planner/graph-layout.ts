/**
 * Where the cards go on the prerequisite board.
 *
 * Pure, and separate from the component, so the one thing that actually went
 * wrong — cards landing on top of each other — can be checked without a
 * browser. The first version placed neighbours at fixed offsets from whatever
 * you dropped, which is fine for one course and a pile-up for three.
 *
 * The arrangement is a layered one, the way anybody would draw a family tree:
 * a course sits below everything it requires, rows are packed left to right
 * with a fixed gap, and nothing shares a cell. Manual dragging is still
 * allowed afterwards — this decides where things START, not where they must
 * stay.
 */

export const CARD_W = 180
export const CARD_H = 66
export const GAP_X = 28
export const GAP_Y = 64

export interface Placeable {
  code: string
  /** Codes this one requires, whether or not they are on the board. */
  needs: string[]
}

export interface Positioned {
  code: string
  x: number
  y: number
}

/**
 * Depth = the longest chain of prerequisites leading to this card.
 *
 * Longest rather than shortest, so a course never sits above something it
 * depends on: if A → B → C and also A → C, C must be on row 2, not row 1.
 * Cycles cannot happen in a real calendar, but a `seen` set means a bad one
 * cannot hang the page either.
 */
export function depths(nodes: Placeable[]): Map<string, number> {
  const onBoard = new Map(nodes.map((n) => [n.code, n]))
  const out = new Map<string, number>()

  const walk = (code: string, seen: Set<string>): number => {
    const cached = out.get(code)
    if (cached !== undefined) return cached
    if (seen.has(code)) return 0
    seen.add(code)
    const node = onBoard.get(code)
    let d = 0
    for (const need of node?.needs ?? []) {
      if (!onBoard.has(need)) continue
      d = Math.max(d, walk(need, seen) + 1)
    }
    seen.delete(code)
    out.set(code, d)
    return d
  }

  for (const n of nodes) walk(n.code, new Set())
  return out
}

/**
 * Lay every card out in rows by depth, centred, never overlapping.
 *
 * `previous` positions are used only for ORDERING within a row — if you have
 * dragged two cards side by side, they keep their left-to-right relationship
 * rather than jumping past each other. That makes a tidy-up feel like tidying
 * rather than like starting again.
 */
export function layout(nodes: Placeable[], previous?: Map<string, Positioned>): Positioned[] {
  if (nodes.length === 0) return []
  const depth = depths(nodes)

  const rows = new Map<number, Placeable[]>()
  for (const n of nodes) {
    const d = depth.get(n.code) ?? 0
    if (!rows.has(d)) rows.set(d, [])
    rows.get(d)!.push(n)
  }

  const widest = Math.max(...[...rows.values()].map((r) => r.length))
  const boardW = widest * CARD_W + (widest - 1) * GAP_X

  const out: Positioned[] = []
  for (const [d, row] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    row.sort((a, b) => {
      const ax = previous?.get(a.code)?.x
      const bx = previous?.get(b.code)?.x
      // Cards that were never on the board sort after ones that were, so a new
      // arrival appends rather than shoving the existing row sideways.
      if (ax === undefined && bx === undefined) return a.code.localeCompare(b.code)
      if (ax === undefined) return 1
      if (bx === undefined) return -1
      return ax - bx
    })
    const rowW = row.length * CARD_W + (row.length - 1) * GAP_X
    const startX = 24 + (boardW - rowW) / 2
    row.forEach((n, i) => {
      out.push({
        code: n.code,
        x: Math.round(startX + i * (CARD_W + GAP_X)),
        y: 24 + d * (CARD_H + GAP_Y),
      })
    })
  }
  return out
}

/** The board's extent, for the minimap and the scroll area. */
export function extent(positions: Positioned[]): { w: number; h: number } {
  if (positions.length === 0) return { w: 0, h: 0 }
  return {
    w: Math.max(...positions.map((p) => p.x + CARD_W)) + 24,
    h: Math.max(...positions.map((p) => p.y + CARD_H)) + 24,
  }
}

/** Do any two cards overlap? Used by the tests, and nothing else. */
export function overlaps(positions: Positioned[]): boolean {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i]
      const b = positions[j]
      if (
        a.x < b.x + CARD_W &&
        b.x < a.x + CARD_W &&
        a.y < b.y + CARD_H &&
        b.y < a.y + CARD_H
      ) {
        return true
      }
    }
  }
  return false
}
