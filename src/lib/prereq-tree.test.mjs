/**
 * Walking the prerequisite chain, checked against a fake catalogue.
 *
 *   node src/lib/prereq-tree.test.mjs
 *
 * The failure modes here are not wrong answers, they are hangs and floods: a
 * cycle in the data loops forever, a diamond expands the same subtree twice,
 * and fetching one course at a time turns a four-deep chain into forty
 * requests. Each of those is pinned below, including a count of how many times
 * the fetcher was actually called.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const out = path.join(here, '.prereq-tree.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'prereq-tree.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: root },
)
const { buildPrereqTree, flatten, outstanding } = await import(pathToFileURL(out).href)

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label}` +
      (ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  )
}

/** A fake catalogue, plus a count of how many round trips were made. */
function catalogue(rows) {
  let calls = 0
  const byCode = new Map(
    rows.map((r) => [r.code.replace(/[^A-Z0-9]/g, ''), r]),
  )
  const fetchLevel = async (codes) => {
    calls++
    return codes
      .map((c) => byCode.get(c.replace(/[^A-Z0-9]/g, '')))
      .filter(Boolean)
      .map((r) => ({
        id: r.code,
        subject: r.code.slice(0, 4),
        catalog: r.code.slice(4),
        title: r.title ?? r.code,
        career: 'UGRD',
        class_unit: 3,
        prerequisites: r.prereq ?? null,
      }))
  }
  return { fetchLevel, calls: () => calls }
}

const codes = (node) => flatten(node).map((n) => n.code)

console.log('\na simple chain')
{
  const c = catalogue([
    { code: 'COMP352', prereq: 'Prerequisite: COMP 249.' },
    { code: 'COMP249', prereq: 'Prerequisite: COMP 248.' },
    { code: 'COMP248', prereq: null },
  ])
  const tree = await buildPrereqTree('COMP 352', new Set(), c.fetchLevel)
  check('walks the whole chain', codes(tree), ['COMP352', 'COMP249', 'COMP248'])
  // One call for the root, then one per level: not one per course.
  check('one request per level, not per course', c.calls(), 3)
}

console.log('\nalternatives')
{
  const c = catalogue([
    { code: 'COMP335', prereq: 'Prerequisite: COMP 232 or COEN 231.' },
    { code: 'COMP232', prereq: null },
    { code: 'COEN231', prereq: null },
  ])
  const tree = await buildPrereqTree('COMP 335', new Set(), c.fetchLevel)
  check('both sides of an "or" are shown', codes(tree).sort(), ['COEN231', 'COMP232', 'COMP335'])
  check('they are one requirement, not two', tree.terms.length, 1)
  check('with two alternatives', tree.terms[0].alternatives.length, 2)
}

console.log('\nwhat you have finished')
{
  const c = catalogue([
    { code: 'COMP352', prereq: 'Prerequisite: COMP 249.' },
    { code: 'COMP249', prereq: 'Prerequisite: COMP 248.' },
    { code: 'COMP248', prereq: null },
  ])
  const tree = await buildPrereqTree('COMP 352', new Set(['COMP249']), c.fetchLevel)
  // A finished course is a leaf: what it needed stopped mattering, and
  // expanding it buries the part still to do.
  check('a finished course is not expanded', codes(tree), ['COMP352', 'COMP249'])
  check('and is marked done', flatten(tree)[1].done, true)
  check('nothing is outstanding below it', outstanding(tree).length, 0)
}

console.log('\nthings that would otherwise hang or flood')
{
  // Prerequisite chains should never cycle. "Should never" is not a guarantee
  // about text somebody typed into a calendar.
  const c = catalogue([
    { code: 'AAAA100', prereq: 'Prerequisite: BBBB 200.' },
    { code: 'BBBB200', prereq: 'Prerequisite: AAAA 100.' },
  ])
  const tree = await buildPrereqTree('AAAA 100', new Set(), c.fetchLevel)
  check('a cycle terminates', codes(tree), ['AAAA100', 'BBBB200', 'AAAA100'])
  check('and the repeat is flagged rather than expanded', flatten(tree)[2].repeated, true)
  check('the repeat has no children', flatten(tree)[2].children.length, 0)
}
{
  // A diamond: two different requirements that share a requirement.
  const c = catalogue([
    { code: 'TOPP400', prereq: 'Prerequisite: LEFT 300; RGHT 300.' },
    { code: 'LEFT300', prereq: 'Prerequisite: BASE 100.' },
    { code: 'RGHT300', prereq: 'Prerequisite: BASE 100.' },
    { code: 'BASE100', prereq: null },
  ])
  const tree = await buildPrereqTree('TOPP 400', new Set(), c.fetchLevel)
  const all = codes(tree)
  check('the shared requirement appears under both', all.filter((x) => x === 'BASE100').length, 2)
  check('but is only expanded once', flatten(tree).filter((n) => n.code === 'BASE100' && n.repeated).length, 1)
}
{
  const deep = Array.from({ length: 10 }, (_, i) => ({
    code: `DEEP${100 + i}`,
    prereq: i < 9 ? `Prerequisite: DEEP ${101 + i}.` : null,
  }))
  const c = catalogue(deep)
  const tree = await buildPrereqTree('DEEP 100', new Set(), c.fetchLevel, 3)
  check('the depth limit holds', Math.max(...flatten(tree).map((n) => n.depth)), 3)
}

console.log('\nmissing and unreadable')
{
  const c = catalogue([{ code: 'COMP999', prereq: 'Permission of the Department is required.' }])
  const tree = await buildPrereqTree('COMP 999', new Set(), c.fetchLevel)
  check('prose naming no course yields no children', tree.children.length, 0)
}
{
  const c = catalogue([{ code: 'COMP352', prereq: 'Prerequisite: GONE 101.' }])
  const tree = await buildPrereqTree('COMP 352', new Set(), c.fetchLevel)
  // A requirement we cannot find in the catalogue is still shown: it is on the
  // student's path whether or not our mirror knows about it.
  check('a requirement missing from the catalogue is still listed', codes(tree), ['COMP352', 'GONE101'])
  check('with no course attached', flatten(tree)[1].course, null)
}
{
  const c = catalogue([])
  const tree = await buildPrereqTree('ZZZZ 999', new Set(), c.fetchLevel)
  check('an unknown root does not throw', tree.code, 'ZZZZ999')
  check('and has nothing under it', tree.children.length, 0)
}

fs.unlinkSync(out)
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) FAILED.`)
process.exit(failed === 0 ? 0 : 1)
