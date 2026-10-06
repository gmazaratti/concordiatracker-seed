/**
 * The folder grid's arithmetic, kept pure so it can be tested without a page.
 * No '@/…' imports: the Node test reads this file directly.
 */

export interface TreeFolder {
  id: string
  parentId: string | null
  position: number
  pinned: boolean
  name: string
}

/** The folders directly inside `parentId` (null = the top level), in their
 *  saved order, ties broken by name so the order never flickers. */
export function childrenOf<T extends TreeFolder>(folders: T[], parentId: string | null): T[] {
  return folders
    .filter((f) => (f.parentId ?? null) === parentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

/** The path from the top down to `id`, for the breadcrumb. */
export function pathTo<T extends TreeFolder>(folders: T[], id: string): T[] {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const out: T[] = []
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return out
}

/** Every folder below `id`, at any depth. */
export function descendantIds(folders: TreeFolder[], id: string): Set<string> {
  const out = new Set<string>()
  const walk = (pid: string) => {
    for (const f of folders) {
      if (f.parentId === pid && !out.has(f.id)) {
        out.add(f.id)
        walk(f.id)
      }
    }
  }
  walk(id)
  return out
}

/** Can `moving` go into `target`? Not into itself or anything inside it —
 *  the database refuses that too; this keeps the drop target from lighting up. */
export function canMoveInto(folders: TreeFolder[], moving: string, target: string | null): boolean {
  if (target === null) return true
  if (moving === target) return false
  return !descendantIds(folders, moving).has(target)
}

/**
 * Move `id` to sit before `beforeId` (or at the end when null) among its
 * siblings, and return the new positions that changed — only those, so a
 * drag writes one or two rows, not the whole folder.
 */
export function reorder<T extends TreeFolder>(siblings: T[], id: string, beforeId: string | null): { id: string; position: number }[] {
  const list = siblings.filter((f) => f.id !== id)
  const moving = siblings.find((f) => f.id === id)
  if (!moving) return []
  const at = beforeId ? list.findIndex((f) => f.id === beforeId) : list.length
  list.splice(at < 0 ? list.length : at, 0, moving)
  const changes: { id: string; position: number }[] = []
  list.forEach((f, i) => {
    const position = (i + 1) * 1024
    if (f.position !== position) changes.push({ id: f.id, position })
  })
  return changes
}
