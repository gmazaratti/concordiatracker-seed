// node src/features/notes/folder-tree.test.mjs
import { canMoveInto, childrenOf, descendantIds, pathTo, reorder } from './folder-tree.ts'

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`)
  if (!ok) failed++
}

const F = (id, parentId, position, name = id) => ({ id, parentId, position, pinned: false, name })
const folders = [
  F('fina', null, 1024, 'FINA 210'),
  F('comm', 'business', 1024, 'COMM 305'),
  F('business', null, 2048, 'Business'),
  F('midterm', 'business', 2048, 'Midterm prep'),
  F('deep', 'midterm', 1024, 'Deep'),
]

check('top level in saved order', childrenOf(folders, null).map((f) => f.id).join() === 'fina,business')
check('children of a folder', childrenOf(folders, 'business').map((f) => f.id).join() === 'comm,midterm')
check('breadcrumb path', pathTo(folders, 'deep').map((f) => f.id).join() === 'business,midterm,deep')
check('descendants at any depth', [...descendantIds(folders, 'business')].sort().join() === 'comm,deep,midterm')
check('a folder cannot go into itself', !canMoveInto(folders, 'business', 'business'))
check('a folder cannot go into its own child', !canMoveInto(folders, 'business', 'deep'))
check('a class can go into a folder', canMoveInto(folders, 'fina', 'business'))
check('anything can go to the top', canMoveInto(folders, 'deep', null))

const cycle = [F('a', 'b', 1), F('b', 'a', 2)]
check('a corrupt cycle does not hang the breadcrumb', pathTo(cycle, 'a').length === 2)

const sib = childrenOf(folders, null)
const moved = reorder(sib, 'business', 'fina')
check('reorder moves business first', moved.find((c) => c.id === 'business')?.position === 1024, JSON.stringify(moved))
check('reorder only writes what changed', moved.length === 2, JSON.stringify(moved))
const noop = reorder(sib, 'fina', 'business')
check('dropping in place writes nothing', noop.length === 0, JSON.stringify(noop))
const toEnd = reorder(sib, 'fina', null)
check('null target sends it to the end', toEnd.find((c) => c.id === 'fina')?.position === 2048, JSON.stringify(toEnd))

console.log(failed ? `\nfolder-tree: ${failed} failed` : '\nfolder-tree: all checks passed')
process.exit(failed ? 1 : 0)
