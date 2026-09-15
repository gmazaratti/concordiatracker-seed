/**
 * node src/lib/moodle-match.test.mjs
 *
 * The whole risk in this feature is a WRONG match: offering to move the wrong
 * deadline, which a student might accept. So most of these check that it
 * refuses — different course, generic title, no date, same day. Missing a real
 * match costs a notification; inventing one costs the feature's credibility.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Bundled through esbuild with the `@` alias mapped — the same shim the other
// pure-module tests use, because `@/` only exists inside Vite.
const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.moodle-match.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'moodle-match.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { stripMoodleTitle, codesIn, titlesMatch, findMoodleMismatches } = await import(
  pathToFileURL(out).href
)

let failures = 0
function check(label, ok, detail) {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `\n         ${detail}`}`)
}
const eq = (label, actual, expected) =>
  check(
    label,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  )

console.log('stripMoodleTitle')
eq('the course prefix and the verb both go', stripMoodleTitle('COMM 305 Assignment 2 is due'), 'Assignment 2')
eq('"opens" too', stripMoodleTitle('COMP 248 Quiz 3 opens'), 'Quiz 3')
eq('"closes"', stripMoodleTitle('Quiz 3 closes'), 'Quiz 3')
eq('a bare title is untouched', stripMoodleTitle('Midterm Exam'), 'Midterm Exam')
eq('no-space course codes', stripMoodleTitle('COMP248 Lab 4 is due'), 'Lab 4')
eq('a hyphenated code', stripMoodleTitle('COMM-305 Case Study 1 due'), 'Case Study 1')
eq('stacked whitespace collapses', stripMoodleTitle('  COMM 305   Assignment 2   is due '), 'Assignment 2')

console.log('\ncodesIn')
eq('finds a code in the category line', codesIn('COMM 305 EC'), ['COMM 305'])
eq('and normalises spacing', codesIn('comp248'), ['COMP 248'])
eq('several', codesIn('COMM 305 and COMP 248'), ['COMM 305', 'COMP 248'])
eq('none is empty, not a throw', codesIn('General announcements'), [])

console.log('\ntitlesMatch')
check('identical after normalising', titlesMatch('Assignment #2', 'assignment 2'))
check('a qualifier does not break it', titlesMatch('Assignment 2', 'Assignment 2 (group)'))
check('DIFFERENT NUMBERS NEVER MATCH', !titlesMatch('Quiz 1', 'Quiz 4'))
check('a bare category never matches an item', !titlesMatch('Quiz', 'Quiz 4'))
check('a short containment is refused', !titlesMatch('Lab', 'Lab 4'))
check('unrelated titles', !titlesMatch('Midterm Exam', 'Final Exam'))
check('empty is not a match', !titlesMatch('', 'Assignment 2'))

console.log('\nfindMoodleMismatches')
const COURSES = [
  { id: 'c1', code: 'COMM 305' },
  { id: 'c2', code: 'COMP 248' },
]
const ASSESSMENTS = [
  { id: 'a1', courseId: 'c1', title: 'Assignment 2', due: '2026-10-12T23:59:00.000Z' },
  { id: 'a2', courseId: 'c1', title: 'Midterm exam', due: '2026-11-01T22:00:00.000Z' },
  { id: 'a3', courseId: 'c2', title: 'Assignment 2', due: '2026-10-12T23:59:00.000Z' },
  { id: 'a4', courseId: 'c1', title: 'Final exam', due: null },
]
const task = (over) => ({
  id: 't',
  title: 'COMM 305 Assignment 2 is due',
  due: '2026-10-19T23:59:00.000Z',
  note: 'COMM 305 EC',
  source: 'moodle',
  ...over,
})

const hits = findMoodleMismatches([task({})], ASSESSMENTS, COURSES)
eq('one mismatch found', hits.length, 1)
eq('and it is the right assessment', hits[0].assessmentId, 'a1')
eq('it carries your date', hits[0].yourDue, '2026-10-12T23:59:00.000Z')
eq("and Moodle's", hits[0].moodleDue, '2026-10-19T23:59:00.000Z')
eq('and what it matched on, so the match is checkable', hits[0].viaTitle, 'COMM 305 Assignment 2 is due')

check(
  'the COMP 248 assignment of the same name is NOT touched',
  !hits.some((h) => h.assessmentId === 'a3'),
)
eq(
  'same day is not a move, even at a different time',
  findMoodleMismatches([task({ due: '2026-10-12T18:00:00.000Z' })], ASSESSMENTS, COURSES).length,
  0,
)
eq(
  'a hand-typed todo is ignored — only synced items speak for Moodle',
  findMoodleMismatches([task({ source: undefined })], ASSESSMENTS, COURSES).length,
  0,
)
eq(
  'an event naming no course is skipped rather than guessed across classes',
  findMoodleMismatches([task({ title: 'Assignment 2 is due', note: '' })], ASSESSMENTS, COURSES).length,
  0,
)
eq(
  'a course we do not track is skipped',
  findMoodleMismatches([task({ title: 'POLI 202 Assignment 2 is due', note: 'POLI 202' })], ASSESSMENTS, COURSES)
    .length,
  0,
)
eq(
  'an undated assessment is never given a date by a fuzzy match',
  findMoodleMismatches(
    [task({ title: 'COMM 305 Final exam is due', note: 'COMM 305' })],
    ASSESSMENTS,
    COURSES,
  ).length,
  0,
)
eq(
  'a generic Moodle event matches nothing',
  findMoodleMismatches([task({ title: 'COMM 305 Quiz opens', note: 'COMM 305' })], ASSESSMENTS, COURSES)
    .length,
  0,
)
eq(
  'two synced events cannot both claim one assessment',
  findMoodleMismatches(
    [task({ id: 't1' }), task({ id: 't2', due: '2026-10-20T23:59:00.000Z' })],
    ASSESSMENTS,
    COURSES,
  ).length,
  1,
)
eq('no tasks is no work', findMoodleMismatches([], ASSESSMENTS, COURSES).length, 0)
eq('no courses means nothing can be placed', findMoodleMismatches([task({})], ASSESSMENTS, []).length, 0)

console.log(failures === 0 ? '\nmoodle-match: all checks passed' : `\nmoodle-match: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
