/**
 * node src/lib/record-summary.test.mjs
 *
 * Built from a REAL record that showed the bug: 22 courses, COMM 226 failed in
 * Fall 2025 and retaken for an A+ in Winter 2026. The profile said 60 credits
 * and "over 60 graded credits" while the GPA had already been computed over
 * 57 — the app disagreeing with itself, with the wrong number in the bigger
 * font.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.record-summary.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'record-summary.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { summarizeRecord } = await import(pathToFileURL(out).href)

let failures = 0
const check = (l, ok, d) => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${l}${ok || d === undefined ? '' : `\n         ${d}`}`) }
const eq = (l, a, b) => check(l, a === b, `expected ${b}, got ${a}`)

let seq = 0
const c = (code, credits, term, percent) => ({
  id: `c${++seq}`, code, title: code, credits, term, archived: true,
  finalPercent: percent, color: 'blue', instructor: { name: '', email: '' },
  section: '', meetingTimes: '', location: '', syllabusUrl: '',
})

// The real shape: a fail, then a pass of the same course a term later.
const record = [
  c('COMM 217', 3, 'Fall 2025', 55),     // C
  c('COMM 226', 3, 'Fall 2025', 40),     // F  <- superseded below
  c('COMM 221', 3, 'Winter 2026', 85),   // A
  c('COMM 226', 3, 'Winter 2026', 95),   // A+ <- the attempt that counts
]
const s = summarizeRecord(record, [])
console.log('a failed-then-retaken course')
eq('credits count the course ONCE, not twice', s.credits, 9)
eq('graded credits match what the GPA used', s.gradedCredits, 9)
eq('all four attempts still LISTED on the record', s.courseCount, 4)
check('the GPA is computed, not null', typeof s.gpa === 'number')

console.log('\na fail that was never retaken')
const unretaken = [c('MATH 208', 3, 'Fall 2024', 45), c('ECON 201', 3, 'Fall 2024', 70)]
const u = summarizeRecord(unretaken, [])
eq('earns no credits for the fail', u.credits, 3)
eq('but still counts in the GPA denominator', u.gradedCredits, 6)

console.log('\nordinary records are unchanged')
const plain = [c('COMP 248', 3.5, 'Fall 2025', 88), c('MATH 203', 3, 'Fall 2025', 75)]
eq('credits add up as before', summarizeRecord(plain, []).credits, 6.5)
eq('and so do graded credits', summarizeRecord(plain, []).gradedCredits, 6.5)

console.log('\nedge cases')
eq('an ungraded archived course still carries its credits', summarizeRecord([c('X 100', 3, 'Fall 2025', null)], []).credits, 3)
eq('and is not counted as graded', summarizeRecord([c('X 100', 3, 'Fall 2025', null)], []).gradedCredits, 0)
eq('an empty record is zero, not NaN', summarizeRecord([], []).credits, 0)
check('and has no GPA rather than 0.00', summarizeRecord([], []).gpa === null)
// An in-progress retake must not suppress the grade already earned.
const inProgress = [c('COMM 226', 3, 'Fall 2025', 95), c('COMM 226', 3, 'Winter 2026', null)]
eq('an ungraded retake does not erase the earned credits', summarizeRecord(inProgress, []).credits, 6)

console.log(failures === 0 ? '\nrecord-summary: all checks passed' : `\nrecord-summary: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
