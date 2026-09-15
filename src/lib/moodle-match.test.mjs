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
const { stripMoodleTitle, codesIn, titlesMatch, findMoodleMismatches, pairMoodleToAssessments, coveredTaskIds, coursesFromMoodle } = await import(
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
// The numbers-agree rule, which is what makes containment safe at all.
check('a longer name for the same work matches', titlesMatch('Group project', 'Group Project Report'))
check('but a bare noun never swallows a numbered one', !titlesMatch('Assignment', 'Assignment 2'))
check('nor does an unnumbered exam', !titlesMatch('Midterm exam', 'Midterm exam 2'))
check('same number, longer name, still matches', titlesMatch('Assignment 2', 'Assignment 2 group hand-in'))
check('different numbers never match however long', !titlesMatch('Assignment 12', 'Assignment 12 and 13'))
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

console.log('\npairMoodleToAssessments — the duplicate question, on real data')
// Verbatim from a live FINA 210 sync: five events, category "FINA-210-2262-B".
const FINA_COURSES = [{ id: 'f1', code: 'FINA 210' }]
const FINA_TASKS = [
  ['Join a Group (Due date)', '2026-09-22T23:59:00.000Z'],
  ['Assignment 1 is due', '2026-09-29T23:59:00.000Z'],
  ['Assignment 2 is due', '2026-11-03T23:59:00.000Z'],
  ['Assignment 3 is due', '2026-11-10T23:59:00.000Z'],
  ['Group project is due', '2026-11-17T23:59:00.000Z'],
].map(([title, due], i) => ({
  id: `m${i}`, title, due, note: 'FINA-210-2262-B · The instructions are included in the Excel file.', source: 'moodle',
}))
// The same course already on the app, from a syllabus.
const FINA_ASSESSMENTS = [
  { id: 'fa1', courseId: 'f1', title: 'Assignment 1', due: '2026-09-29T23:59:00.000Z' },
  { id: 'fa2', courseId: 'f1', title: 'Assignment 2', due: '2026-11-03T23:59:00.000Z' },
  { id: 'fa3', courseId: 'f1', title: 'Assignment 3', due: '2026-11-10T23:59:00.000Z' },
  { id: 'fa4', courseId: 'f1', title: 'Group Project Report', due: '2026-11-17T23:59:00.000Z' },
]
const fpairs = pairMoodleToAssessments(FINA_TASKS, FINA_ASSESSMENTS, FINA_COURSES)
eq('four of the five are recognised as duplicates', fpairs.length, 4)
const covered = coveredTaskIds(fpairs)
const survivors = FINA_TASKS.filter((t) => !covered.has(t.id)).map((t) => t.title)
eq('only the one no syllabus lists survives', survivors, ['Join a Group (Due date)'])
check('and none of them is reported as a date change', fpairs.every((p) => !p.differs))
eq('so nothing nags the student', findMoodleMismatches(FINA_TASKS, FINA_ASSESSMENTS, FINA_COURSES).length, 0)

// Same set, but the professor moved Assignment 2 a week.
const moved = FINA_TASKS.map((t) =>
  t.title === 'Assignment 2 is due' ? { ...t, due: '2026-11-10T23:59:00.000Z' } : t,
)
const movedPairs = pairMoodleToAssessments(moved, FINA_ASSESSMENTS, FINA_COURSES)
eq('it is still a duplicate, so still only one row', coveredTaskIds(movedPairs).size, 4)
const nags = findMoodleMismatches(moved, FINA_ASSESSMENTS, FINA_COURSES)
eq('but now exactly one change is surfaced', nags.length, 1)
eq('and it is the right one', nags[0].title, 'Assignment 2')

// Without the syllabus, nothing is hidden — all five are the only record.
eq(
  'a course with no assessments hides nothing',
  coveredTaskIds(pairMoodleToAssessments(FINA_TASKS, [], FINA_COURSES)).size,
  0,
)
// An undated assessment still absorbs its duplicate, but claims no change.
const undatedPair = pairMoodleToAssessments(
  [FINA_TASKS[1]],
  [{ id: 'x', courseId: 'f1', title: 'Assignment 1', due: null }],
  FINA_COURSES,
)
eq('an undated assessment still hides the duplicate', undatedPair.length, 1)
check('and never claims it moved', !undatedPair[0].differs)

console.log('\ncoursesFromMoodle - the feed names the classes you are in')
const hints = coursesFromMoodle(FINA_TASKS)
eq('one course, not five', hints.length, 1)
eq('code normalised from FINA-210-2262-B', hints[0].code, 'FINA 210')
eq('term decoded from the same string', hints[0].termCode, '2262')
eq('and the section', hints[0].section, 'B')
eq('with a count of what named it', hints[0].events, 5)

const mixed = [
  { id: '1', title: 'x', due: '2026-10-01T00:00:00Z', note: 'COMP-248-2262-BB', source: 'moodle' },
  { id: '2', title: 'y', due: '2026-10-02T00:00:00Z', note: 'FINA-210-2262-B', source: 'moodle' },
  { id: '3', title: 'z', due: '2026-10-03T00:00:00Z', note: 'Chemistry Help Centre', source: 'moodle' },
  { id: '4', title: 'w', due: '2026-10-04T00:00:00Z', note: '', source: undefined },
]
eq('two real courses out of four events', coursesFromMoodle(mixed).length, 2)
eq('sorted by code', coursesFromMoodle(mixed).map((c) => c.code), ['COMP 248', 'FINA 210'])
check(
  'a Moodle space that is not a course yields nothing',
  !coursesFromMoodle(mixed).some((c) => /CHEM|HELP/.test(c.code)),
)
check('a hand-typed todo is never read as a course', coursesFromMoodle([mixed[3]]).length === 0)
eq('an empty feed is empty', coursesFromMoodle([]).length, 0)
eq(
  'a name with no term or section still gives the code',
  coursesFromMoodle([{ id: 'a', title: 't', due: '2026-10-01T00:00:00Z', note: 'ENGL-251', source: 'moodle' }])[0],
  { code: 'ENGL 251', termCode: undefined, section: undefined, events: 1 },
)

console.log(failures === 0 ? '\nmoodle-match: all checks passed' : `\nmoodle-match: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
