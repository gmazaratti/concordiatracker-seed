/**
 * Undated assessments: the rules that keep "we don't know when" from becoming
 * "it's due now".
 *
 *   node src/features/today/undated.test.mjs
 *
 * The failure this guards against is specific and quiet: `new Date(null)` is
 * 1 January 1970, so an undated item treated as dated does not throw — it
 * silently becomes the most overdue thing you own and sits at the top of the
 * list forever. Every assertion below exists because that is the shape of the
 * mistake.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..', '..')
const out = (n) => path.join(here, `.${n}.tmp.mjs`)

const bundle = (src, name) => {
  execSync(
    `npx esbuild "${path.join(root, src)}" --bundle --format=esm --alias:@=./src --outfile="${out(name)}"`,
    { stdio: 'pipe', cwd: root },
  )
  return pathToFileURL(out(name)).href
}

const { groupDue } = await import(bundle('src/features/today/due.ts', 'due'))
const { byDue, daysUntil, relativeDueLabel } = await import(bundle('src/lib/date.ts', 'date'))
for (const n of ['due', 'date']) fs.rmSync(out(n), { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const iso = (days) => new Date(Date.now() + days * 86_400_000).toISOString()
const item = (id, due, weight = 10) => ({
  id,
  courseId: 'c1',
  title: id,
  kind: 'assignment',
  weight,
  due,
  status: 'not-started',
  grade: null,
  provenance: { status: 'official', confirmedBy: 0 },
  notes: '',
})

console.log('\ndaysUntil')
check('undated is Infinity, so never overdue', daysUntil(null) === Infinity)
check('and never "due today"', daysUntil(null) !== 0)
check('a real date still works', daysUntil(iso(3)) === 3, String(daysUntil(iso(3))))
// The trap: without the guard this would be 1970, i.e. ~20,000 days overdue.
check('not treated as the epoch', daysUntil(null) > 0, String(daysUntil(null)))

console.log('\nbyDue')
const shuffled = [item('none', null), item('soon', iso(1)), item('later', iso(30))]
check(
  'undated sorts LAST, never first',
  [...shuffled].sort(byDue).map((a) => a.id).join(',') === 'soon,later,none',
  [...shuffled].sort(byDue).map((a) => a.id).join(','),
)
check('two undated are equal, not reordered', byDue(item('a', null), item('b', null)) === 0)

console.log('\ngroupDue')
const g = groupDue([
  item('overdue', iso(-2)),
  item('thisweek', iso(2)),
  item('later', iso(20)),
  item('undated-1', null),
  item('undated-2', null),
])
check('undated gets its own bucket', g.undated.length === 2, String(g.undated.length))
check('and is in none of the time buckets', ![...g.overdue, ...g.thisWeek, ...g.later].some((a) => !a.due))
check('overdue is only genuinely overdue work', g.overdue.length === 1 && g.overdue[0].id === 'overdue')
// The distinction that matters: `count` drives the pain nudge and the glance
// strip. Nothing without a date can be near-term pressure.
check('count excludes undated', g.count === 2, String(g.count))
check('total includes it, so the list does not under-report', g.total === 5, String(g.total))
check('nextUp is never an undated item', g.nextUp?.id === 'thisweek', g.nextUp?.id)

const onlyUndated = groupDue([item('x', null)])
check('a term of only undated work: nextUp is null, not a guess', onlyUndated.nextUp === null)
check('  and count is 0 while total is 1', onlyUndated.count === 0 && onlyUndated.total === 1)

console.log('\nrelativeDueLabel')
check('says so rather than rendering a date', relativeDueLabel(null) === 'Date not set', relativeDueLabel(null))
check('never says "overdue" for an undated item', !relativeDueLabel(null).toLowerCase().includes('overdue'))

console.log(failed === 0 ? '\nundated: all checks passed' : `\nundated: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
