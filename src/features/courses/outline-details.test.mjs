/**
 * What an outline may fill in, and what it must leave alone.
 *
 *   node src/features/courses/outline-details.test.mjs
 *
 * The failure this guards is quiet and infuriating: an import that overwrites
 * the instructor a student typed, with a name off a PDF from a different term.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..', '..')
const out = path.join(here, '.outline.tmp.mjs')
execSync(
  `npx esbuild "${path.join(root, 'src/features/courses/outline-details.ts')}" --bundle --format=esm --alias:@=./src --outfile="${out}"`,
  { stdio: 'pipe', cwd: root },
)
const { outlineDetails, describeDetails } = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const outline = {
  instructor: 'Michel Deslauriers',
  instructorEmail: 'michel.deslauriers@concordia.ca',
  officeHours: 'By appointment',
  officeLocation: 'MB 12.234',
  classroom: 'MB S1.235',
}
const blank = {
  instructor: { name: '', email: '' },
  officeHours: '',
  location: '',
}

console.log('\nfilling a blank course')
{
  const p = outlineDetails(outline, blank)
  check('takes the instructor', p.instructor?.name === 'Michel Deslauriers')
  check('and their email', p.instructor?.email === 'michel.deslauriers@concordia.ca')
  check('takes the office hours verbatim', p.officeHours === 'By appointment')
  check('takes the CLASSROOM as the location', p.location === 'MB S1.235', p.location)
  // The professor's office is not where the class meets.
  check('not the office as the location', p.location !== 'MB 12.234')
}

console.log('\nnever overwriting the student')
{
  const mine = {
    instructor: { name: 'Someone Else', email: 'them@concordia.ca' },
    officeHours: 'Wed 14:00',
    location: 'H 620',
  }
  const p = outlineDetails(outline, mine)
  check('leaves the instructor alone', p.instructor === undefined)
  check('leaves office hours alone', p.officeHours === undefined)
  check('leaves the room alone', p.location === undefined)
  check('so there is nothing to write at all', Object.keys(p).length === 0)
}
{
  // A half-filled instructor is still the student's answer: filling an email
  // onto a DIFFERENT professor's name is worse than filling neither.
  const partial = { instructor: { name: 'Someone Else', email: '' }, officeHours: '', location: '' }
  const p = outlineDetails(outline, partial)
  check('a named instructor with no email is not topped up', p.instructor === undefined)
  check('but the other blanks still fill', p.officeHours === 'By appointment')
}

console.log('\nan outline that says nothing')
{
  const bare = { instructor: '', term: 'Fall 2026' }
  const p = outlineDetails(bare, blank)
  check('adds nothing', Object.keys(p).length === 0, JSON.stringify(p))
}
{
  const whitespace = { instructor: '   ', officeHours: '  ', classroom: '' }
  const p = outlineDetails(whitespace, blank)
  check('whitespace is not a value', Object.keys(p).length === 0, JSON.stringify(p))
}

console.log('\nsaying what happened')
{
  check('one thing', describeDetails({ officeHours: 'x' }) === 'office hours')
  check(
    'three things read as a sentence',
    describeDetails({ instructor: { name: 'a', email: '' }, officeHours: 'x', location: 'y' }) ===
      'instructor, office hours and room',
  )
  check('nothing says nothing', describeDetails({}) === null)
}

console.log(
  failed === 0 ? '\noutline-details: all checks passed' : `\noutline-details: ${failed} FAILED`,
)
process.exit(failed === 0 ? 0 : 1)
