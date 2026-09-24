/**
 * Grades that are grades, and one course per course.
 *
 *   node src/lib/course-integrity.test.mjs
 *
 * Both rules came from QA as a regular user: "abc" saved as a grade and wiped
 * a real 82%, "150" saved as an A+, and one class became three records. The
 * database now refuses both (db/course_integrity.sql); these pin the rules the
 * screens apply before they ever ask it.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const entry = path.join(here, '.course-integrity.entry.tmp.ts')
const out = path.join(here, '.course-integrity.test.tmp.mjs')

fs.writeFileSync(
  entry,
  "export * from './grade'\nexport * from './course-match'\nexport { parsePrereq, checkPrereq } from './prereq'\nexport { extractCourseCodes } from './catalog-pure-shim'\n",
)
// catalog.ts imports Supabase; the one function under test is pure, so a shim
// re-exports it without the client.
fs.writeFileSync(
  path.join(here, 'catalog-pure-shim.ts'),
  fs
    .readFileSync(path.join(here, 'catalog.ts'), 'utf8')
    .match(/export function extractCourseCodes[\s\S]*?\n}\n/)[0],
)
try {
  execSync(`npx esbuild --bundle "${entry}" --format=esm "--alias:@=./src" --outfile="${out}"`, {
    stdio: 'pipe',
    cwd: root,
  })
} finally {
  fs.rmSync(entry, { force: true })
  fs.rmSync(path.join(here, 'catalog-pure-shim.ts'), { force: true })
}
const m = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${ok ? '' : `\n        got      ${JSON.stringify(actual)}\n        expected ${JSON.stringify(expected)}`}`)
}
const kind = (t) => m.readGradeInput(t).kind

// ── Grades ───────────────────────────────────────────────────────────────────
check('empty clears', kind(''), 'empty')
check('spaces clear', kind('   '), 'empty')
check('82 is a grade', m.readGradeInput('82'), { kind: 'grade', grade: { mode: 'percent', percent: 82, earned: null, total: null } })
check('82% is a grade', kind('82%'), 'grade')
check('0 is a grade', kind('0'), 'grade')
check('100 is a grade', kind('100'), 'grade')
check('82.5 is a grade', kind('82.5'), 'grade')
check('"abc" is NOT "no grade"', kind('abc'), 'invalid')
check('"82abc" is invalid', kind('82abc'), 'invalid')
check('150 is invalid', kind('150'), 'invalid')
check('100.5 is invalid', kind('100.5'), 'invalid')
check('-10 is invalid', kind('-10'), 'invalid')
check('-10 says why', m.readGradeInput('-10').error, 'A grade can’t be below 0%.')
check('15/20 is a raw grade', m.readGradeInput('15/20'), { kind: 'grade', grade: { mode: 'raw', earned: 15, total: 20, percent: null } })
check('15 / 20 with spaces', kind('15 / 20'), 'grade')
check('21/20 is more than full marks', kind('21/20'), 'invalid')
check('15/0 has no total', kind('15/0'), 'invalid')
check('15/ is incomplete', kind('15/'), 'invalid')
check('/20 is incomplete', kind('/20'), 'invalid')
check('1/2/3 is not a score', kind('1/2/3'), 'invalid')
check('a/b is not a score', kind('a/b'), 'invalid')
check('display helper: invalid shows as no grade', m.parseGradeInput('abc'), null)
check('display helper: valid resolves', m.gradeToPercent(m.parseGradeInput('15/20')), 75)

// ── One course per course ────────────────────────────────────────────────────
const record = [
  { id: 'a', code: 'COMP 248', term: 'Fall 2026' },
  { id: 'b', code: 'RELI 230', term: 'Fall 2026' },
  { id: 'c', code: 'COMP 248', term: 'Winter 2025', archived: true },
  { id: 'd', code: '', term: 'Fall 2026' },
]
check('same code, same term → the existing record', m.findSameCourse(record, 'comp-248', 'FALL 2026')?.id, 'a')
check('other term → not a duplicate', m.findSameCourse(record, 'RELI 230', 'Winter 2027'), undefined)
check('untitled never matches', m.findSameCourse(record, '', 'Fall 2026'), undefined)
check('retake is reported', m.otherAttempts(record, 'COMP 248', 'Fall 2026').map((c) => c.id), ['c'])
check('batch repeats', m.batchRepeats(['COMP 248', 'MATH 205', 'comp248', '']), [false, false, true, false])

// ── Where an uploaded syllabus goes ──────────────────────────────────────────
check('outline for a course you have → that course', m.syllabusTarget(record, 'RELI230', '')?.id, 'b')
check('outline naming the same term → that course', m.syllabusTarget(record, 'RELI 230', 'Fall 2026')?.id, 'b')
check('outline for ANOTHER term → a new course', m.syllabusTarget(record, 'RELI 230', 'Winter 2027'), undefined)
check('unreadable term → the code decides', m.syllabusTarget(record, 'RELI 230', 'Semester 1')?.id, 'b')
check('finished courses are never a target', m.syllabusTarget([record[2]], 'COMP 248', ''), undefined)
check('no such course → a new course', m.syllabusTarget(record, 'HIST 203', ''), undefined)

// ── A course is never its own prerequisite ───────────────────────────────────
check(
  'self-label dropped',
  m.extractCourseCodes('PREREQ COMP425: must complete all 200 level courses', 'COMP 425'),
  [],
)
check(
  'real prerequisites kept',
  m.extractCourseCodes('Prerequisite FMAN 450; COMP 352 and MATH 205', 'FMAN 450'),
  ['COMP 352', 'MATH 205'],
)
check(
  'COMP 425 does not require COMP 425',
  m.parsePrereq('PREREQ COMP425: must complete all 200 level courses before enrolling', 'COMP 425').terms.length,
  0,
)
check(
  '…so it is not "not met" for a student without it',
  m.checkPrereq('Prerequisite FMAN 450', { completed: new Set(), credits: 0 }, 'FMAN 450').verdict !== 'not-met',
  true,
)
check(
  'a real requirement still counts',
  m.checkPrereq('Prerequisite: COMP 352', { completed: new Set(), credits: 0 }, 'COMP 425').verdict,
  'not-met',
)
check('without a self code nothing is dropped', m.extractCourseCodes('PREREQ COMP425: x'), ['COMP425'])

console.log(failed === 0 ? '\ncourse integrity: all checks passed' : `\n${failed} check(s) failed`)
process.exit(failed === 0 ? 0 : 1)
