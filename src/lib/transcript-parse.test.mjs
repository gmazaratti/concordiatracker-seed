/**
 * Reading a pasted transcript.
 *
 *   node src/lib/transcript-parse.test.mjs
 *
 * The dangerous failure here is not a missed course, it is a WRONG one: a class
 * number read as a grade, a year read as credits, a course filed under the term
 * above it. Those produce a plausible record nobody checks. So the cases below
 * lean on what must NOT be inferred as much as on what must.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const out = path.join(here, '.transcript-parse.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'transcript-parse.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: root },
)
const { parseTranscript, readyRows } = await import(pathToFileURL(out).href)

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label}` +
      (ok ? '' : `\n         expected ${JSON.stringify(expected)}\n         got      ${JSON.stringify(actual)}`),
  )
}
const parse = (t) => parseTranscript(t)
const codes = (t) => parse(t).rows.map((r) => r.code)

console.log('\na term heading applies to what follows')
{
  const r = parse(`
Fall 2025
COMM 217  Financial Accounting   3.00  C
COMM 214  Business Analytics     3.00  A+
Winter 2026
COMM 223  Marketing Management   3.00  B-
`)
  check('every course is found', r.rows.map((x) => x.code), ['COMM 217', 'COMM 214', 'COMM 223'])
  check('the heading files the ones under it', r.rows.map((x) => x.term), [
    'Fall 2025', 'Fall 2025', 'Winter 2026',
  ])
  check('grades come across', r.rows.map((x) => x.grade), ['C', 'A+', 'B-'])
  check('credits come across', r.rows.map((x) => x.credits), [3, 3, 3])
  check('titles come across', r.rows[0].title, 'Financial Accounting')
}

console.log('\nother layouts of the same thing')
{
  const tabbed = 'COMP 248\tObject-Oriented Programming I\t3\tA-\tFall 2024'
  const r = parse(tabbed)
  check('tab separated', r.rows[0].code, 'COMP 248')
  check('and reads its term from the same line', r.rows[0].term, 'Fall 2024')
  check('and its grade', r.rows[0].grade, 'A-')
}
check('no space in the code', codes('COMP248 Something 3 A'), ['COMP 248'])
check('hyphenated code', codes('COMP-248 Something 3 A'), ['COMP 248'])
check('lowercase code', codes('comp 248 something 3 a'), [])
check('three-letter subject', codes('Fall 2025\nMBA 642 Strategy 3 B'), ['MBA 642'])
check('four-digit catalogue number', codes('Fall 2025\nCOMP 5261 Advanced 4 A'), ['COMP 5261'])

console.log('\nthings it must NOT infer')
{
  // A transcript line is full of numbers. Reading the wrong one as a grade
  // produces a plausible record that nobody double-checks.
  const r = parse('Fall 2025\nCOMM 217 Financial Accounting 6306 3.00')
  check('two bare numbers is ambiguous, so no grade', r.rows[0].grade, null)
}
{
  const r = parse('Fall 2025\nCOMM 217 Financial Accounting 3.00')
  // 3.00 already matched the credit column, so it is not also a grade.
  check('the credit figure is not read as a grade', r.rows[0].grade, null)
  check('but it is read as credits', r.rows[0].credits, 3)
}
{
  const r = parse('COMM 217 Financial Accounting 3.00 C')
  // No heading, no term on the line: it cannot be filed, and guessing a
  // semester for someone's transcript is worse than asking.
  check('a course with no term is not guessed', r.rows[0].term, null)
  check('and is surfaced as unread', r.unread.length, 1)
  check('and is not ready to save', readyRows(r).length, 0)
}
check('a line with no course code is ignored', parse('Cumulative GPA 2.75').rows.length, 0)
check('a term heading alone adds nothing', parse('Fall 2025').rows.length, 0)
check('empty input is safe', parse('').rows.length, 0)
check('whitespace only is safe', parse('   \n  \n').rows.length, 0)

console.log('\nrepeats and duplicates')
{
  const r = parse(`
Fall 2025
COMM 226 Business Technology 3.00 F
Winter 2026
COMM 226 Business Technology 3.00 A+
`)
  // The same course in two terms is a REPEAT, not a duplicate, and both belong
  // on the transcript - the GPA rules decide which one counts.
  check('the same course in two terms is kept twice', r.rows.length, 2)
  check('with their own grades', r.rows.map((x) => x.grade), ['F', 'A+'])
}
{
  const r = parse('Fall 2025\nCOMM 217 Accounting 3 C\nCOMM 217 Accounting 3 C')
  check('the same course twice in one term is one row', r.rows.length, 1)
}

console.log('\nseasons written differently')
check('Autumn is Fall', parse('Autumn 2025\nCOMP 248 x 3 A').rows[0].term, 'Fall 2025')
check('Spring is Winter', parse('Spring 2026\nCOMP 248 x 3 A').rows[0].term, 'Winter 2026')

console.log('\nnotations')
check('FNS survives', parse('Fall 2025\nCOMM 217 Accounting 3 FNS').rows[0].grade, 'FNS')
check('a percentage survives', parse('Fall 2025\nCOMM 217 Accounting 3 87').rows[0].grade, '87')

fs.unlinkSync(out)
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) FAILED.`)
process.exit(failed === 0 ? 0 : 1)
