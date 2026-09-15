// Node check for the record export: shaping, ordering, and both serialisations.
// Run: node src/lib/record-export.test.mjs
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Bundled through esbuild with the `@` alias mapped, the same shim the other
// pure-module tests use — `@/` only exists inside Vite.
const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.record-export.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'record-export.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { buildRecordSnapshot, recordToCsv, recordToText, recordFilename } = await import(
  pathToFileURL(out).href
)

let fails = 0
function ok(name, cond) {
  if (cond) console.log(`  ok    ${name}`)
  else {
    fails++
    console.log(`  FAIL  ${name}`)
  }
}

const past = [
  { code: 'comp 248', title: 'Object-Oriented Programming I', credits: 3.5, term: 'Fall 2025', finalLetter: 'A' },
  { code: 'MATH 203', title: 'Differential & Integral Calculus I', credits: 3, term: 'Fall 2025' },
  { code: 'COMM 210', title: 'Contemporary Business Thinking', credits: 3, term: 'Winter 2026', finalLetter: 'B+' },
]
const summary = { credits: 9.5, gradedCredits: 6.5, gpa: 3.65, courseCount: 3 }

const snap = buildRecordSnapshot({
  name: 'Alex Degryse',
  handle: 'alex',
  program: 'Finance',
  year: 2,
  minor: null,
  pastCourses: past,
  summary,
  now: new Date('2026-09-14T12:00:00Z'),
})

console.log('\nShaping')
ok('terms are newest first', snap.terms[0].term === 'Winter 2026')
ok('codes are normalised and uppercased', snap.terms[1].courses[0].code === 'COMP 248')
ok('courses sort by code inside a term', snap.terms[1].courses[1].code === 'MATH 203')
ok('per-term credits add up', snap.terms[1].credits === 6.5)
ok('an ungraded course is kept, without a letter', snap.terms[1].courses[1].letter === undefined)
ok('totals come from the summary, not a second calculation', snap.credits === 9.5 && snap.gpa === 3.65)
ok('it is dated', snap.generatedAt.startsWith('2026-09-14'))

console.log('\nCSV')
const csv = recordToCsv(snap)
const head = csv.split('\n')[0]
ok('header row', head === '"Term","Code","Title","Credits","Grade"')
ok('one row per course', csv.split('\n').filter((l) => l.startsWith('"Fall 2025"')).length === 2)
ok('a comma in a title cannot split the row', csv.includes('"Differential & Integral Calculus I"'))
ok('totals are appended', csv.includes('"Total credits","9.5"') && csv.includes('"GPA","3.65"'))

const quoted = buildRecordSnapshot({
  name: 'Q',
  pastCourses: [{ code: 'X 1', title: 'He said "hi"', credits: 3, term: 'Fall 2025' }],
  summary: { credits: 3, gradedCredits: 0, gpa: null, courseCount: 1 },
  now: new Date('2026-09-14T12:00:00Z'),
})
ok('an inner quote is doubled', recordToCsv(quoted).includes('"He said ""hi"""'))
ok('no GPA leaves the cell empty, not "null"', recordToCsv(quoted).includes('"GPA",""'))

console.log('\nText')
const txt = recordToText(snap)
ok('leads with the name', txt.startsWith('Alex Degryse'))
ok('identity line joins what exists', txt.includes('@alex · Finance · Year 2'))
ok('states what the GPA covers', txt.includes('3.65 over 6.5 graded credits'))
ok('says so when there is no GPA', recordToText(quoted).includes('GPA not calculated'))
ok('every course appears', past.every((c) => txt.includes(c.code.toUpperCase())))

console.log('\nFilename')
ok('safe and dated', recordFilename(snap, 'csv') === 'alex-record-2026-09-14.csv')
ok('falls back to the name', recordFilename(quoted, 'csv') === 'q-record-2026-09-14.csv')

console.log(fails === 0 ? '\nrecord-export: all checks passed' : `\nrecord-export: ${fails} FAILED`)
process.exit(fails === 0 ? 0 : 1)
