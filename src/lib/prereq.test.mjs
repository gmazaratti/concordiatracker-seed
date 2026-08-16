/**
 * Checks the prerequisite parser against sentences taken VERBATIM from
 * Concordia's undergraduate calendar.
 *
 *   node src/lib/prereq.test.mjs
 *
 * The parser decides whether someone can register for a course, so the cost of
 * a wrong answer is a wasted semester. Every case below is a real string, not
 * an invented one, and the cases that must return "unknown" matter as much as
 * the ones that must return "met".
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.prereq.test.mjs.tmp.mjs')

// Strip the types rather than adding a build step for one file.
const src = fs.readFileSync(path.join(here, 'prereq.ts'), 'utf8')
execSync(
  `npx esbuild "${path.join(here, 'prereq.ts')}" --format=esm --loader:.ts=ts --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { parsePrereq, evaluate, normalizeCode, describeTerm } = await import(pathToFileURL(out).href)
void src

let failed = 0
const rec = (codes, credits = 90) => ({
  completed: new Set(codes.map(normalizeCode)),
  credits,
})

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label}` +
      (ok ? '' : `\n         expected ${JSON.stringify(expected)}\n         got      ${JSON.stringify(actual)}`),
  )
}

const verdict = (text, r) => evaluate(parsePrereq(text), r).verdict
const missing = (text, r) => evaluate(parsePrereq(text), r).missing.map(describeTerm)

console.log('\nsimple requirement')
const S1 = 'The following course must be completed previously: COMP 248.'
check('met when you have it', verdict(S1, rec(['COMP 248'])), 'met')
check('not met when you do not', verdict(S1, rec([])), 'not-met')
check('names what is missing', missing(S1, rec([])), ['COMP 248'])

console.log('\nOR inside a term (the bug this parser exists to fix)')
const S2 = 'The following courses must be completed previously: COMP 232 or COEN 231; and COMP 249 or COEN 244.'
check('either side of an or satisfies it', verdict(S2, rec(['COMP 232', 'COMP 249'])), 'met')
check('the other side also satisfies it', verdict(S2, rec(['COEN 231', 'COEN 244'])), 'met')
check('mixing sides is fine', verdict(S2, rec(['COMP 232', 'COEN 244'])), 'met')
check('one term short is not met', verdict(S2, rec(['COMP 232'])), 'not-met')
check('and it says which term', missing(S2, rec(['COMP 232'])), ['COMP 249 or COEN 244'])

console.log('\nAND across semicolons')
const S3 = 'The following courses must be completed previously: COMP 233 or ENGR 371; COMP 352; ENCS 282.'
check('all three terms needed', verdict(S3, rec(['COMP 233', 'COMP 352'])), 'not-met')
check('missing term reported', missing(S3, rec(['COMP 233', 'COMP 352'])), ['ENCS 282'])
check('all satisfied', verdict(S3, rec(['ENGR 371', 'COMP 352', 'ENCS 282'])), 'met')

console.log('\n"or equivalent" and Cegep alternatives cannot be ruled out')
const S4 = 'The following course must be completed previously: MATH 201 or equivalent.'
check('met outright when you have the course', verdict(S4, rec(['MATH 201'])), 'met')
check('unknown, not refused, without it', verdict(S4, rec([])), 'unknown')
const S5 =
  'The following courses must be completed previously or concurrently: MATH 203 or Cegep Mathematics 103 or NYA; MATH 204 or Cegep Mathematics 105 or NYC.'
check('a Cegep alternative keeps it open', verdict(S5, rec([])), 'unknown')
check('having both codes settles it', verdict(S5, rec(['MATH 203', 'MATH 204'])), 'met')
check('concurrent flag is captured', parsePrereq(S5).terms[0].concurrent, true)
check('previously-only is not concurrent', parsePrereq(S3).terms[0].concurrent, false)

console.log('\nantirequisite')
const S6 = 'Students who have received credit for COMP 248 or COEN 243 may not take this course for credit.'
check('holding one blocks the course', verdict(S6, rec(['COMP 248'])), 'blocked')
check('holding neither does not block', verdict(S6, rec(['COMP 249'])), 'met')

console.log('\ncredit floor is decidable, because we know the credits')
const S7 = 'Students must complete 60 credits prior to enrolling.'
check('enough credits', verdict(S7, rec([], 72)), 'met')
check('not enough credits', verdict(S7, rec([], 45)), 'not-met')
check('says how short you are', missing(S7, rec([], 45)), ['60 credits (you have 45)'])

console.log('\npermission and standing are readable but not decidable')
check('department permission', verdict('Permission of the Department is required.', rec([])), 'unknown')
check('GCS permission', verdict('Permission of the GCS is required.', rec([])), 'unknown')
check(
  'program standing',
  verdict('Registration in the final year of the honours program is required.', rec([])),
  'unknown',
)
check(
  'permission outranks a satisfied requirement',
  verdict('The following course must be completed previously: COMP 248. Permission of the Department is required.', rec(['COMP 248'])),
  'unknown',
)

console.log('\nnothing to read')
check('empty', verdict('', rec([])), 'met')
check('null', verdict(null, rec([])), 'met')
check('empty text is flagged unreadable', evaluate(parsePrereq(''), rec([])).unreadable, true)
check('a real requirement is not', evaluate(parsePrereq(S1), rec([])).unreadable, false)

console.log('\ncode normalisation')
check('spacing does not matter', verdict(S1, rec(['comp248'])), 'met')
check('punctuation does not matter', verdict(S1, rec(['COMP-248'])), 'met')

fs.unlinkSync(out)
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) FAILED.`)
process.exit(failed === 0 ? 0 : 1)
