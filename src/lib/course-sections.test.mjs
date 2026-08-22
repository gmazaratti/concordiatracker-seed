/**
 * Term codes, section patches, and which terms are genuinely ahead of you.
 *
 *   node src/lib/course-sections.test.mjs
 *
 * All three exist because of the same bug class: a term is a NAME in one half of
 * the app ("Fall 2026") and a CODE in the other ("2262"), and every place they
 * meet is a place the app can quietly show you the wrong semester. The cases
 * that must be REJECTED matter as much as the ones that must map.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const tmp = path.join(here, '.course-sections.test.tmp.mjs')
const tmpTerms = path.join(here, '.later-terms.test.tmp.mjs')

// past-terms.ts reaches through the @/ alias, so it is bundled rather than
// merely stripped. course-sections.ts has no imports Node cannot handle.
execSync(
  `npx esbuild "${path.join(here, 'course-sections.ts')}" --format=esm --loader:.ts=ts --outfile="${tmp}"`,
  { stdio: 'pipe', cwd: root },
)
execSync(
  `npx esbuild "${path.join(root, 'src/features/planner/past-terms.ts')}" --bundle --format=esm --alias:@=./src --outfile="${tmpTerms}"`,
  { stdio: 'pipe', cwd: root },
)

const { termCodeFor, sectionPatch, sortSections } = await import(pathToFileURL(tmp).href)
const { laterTerms, currentTermName } = await import(pathToFileURL(tmpTerms).href)
fs.rmSync(tmp, { force: true })
fs.rmSync(tmpTerms, { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── termCodeFor ─────────────────────────────────────────────────────────────
// Round-trips against lib/seats.ts termLabel: year = 2000 + digits 2-3, season
// from the last digit, and Winter's code year is one BEHIND its name because it
// belongs to the academic year that began the previous autumn.
console.log('\ntermCodeFor')
for (const [name, code] of [
  ['Fall 2026', '2262'],
  ['Winter 2027', '2264'],
  ['Summer 2026', '2261'],
  ['Winter 2026', '2254'],
  ['fall 2026', '2262'], // case is the student's, not ours
  ['  Fall 2026  ', '2262'],
]) {
  const got = termCodeFor(name)
  check(`${name.trim()} -> ${code}`, got === code, `got ${got}`)
}
for (const bad of ['nonsense', 'Fall', '2262', 'Autumn 2026', 'Fall 26', '']) {
  check(`rejects ${JSON.stringify(bad)}`, termCodeFor(bad) === null, `got ${termCodeFor(bad)}`)
}

// ── laterTerms ──────────────────────────────────────────────────────────────
// The bug this replaced: futureTerms() starts at January of the current
// calendar year, so in August it still led with a Winter that ended in April,
// and filtering by NAME only removed the current term.
console.log('\nlaterTerms')
const RANK = { Winter: 0, Summer: 1, Fall: 2 }
const rank = (t) => {
  const [s, y] = t.split(' ')
  return Number(y) * 3 + RANK[s]
}
for (const iso of ['2026-08-22', '2026-01-15', '2026-05-02', '2026-12-31']) {
  const now = new Date(`${iso}T12:00:00`)
  const list = laterTerms(6, now)
  const cur = currentTermName(now)
  check(`${iso}: 6 terms`, list.length === 6, list.join(', '))
  check(
    `${iso}: none at or before ${cur}`,
    list.every((t) => rank(t) > rank(cur)),
    list.join(', '),
  )
  check(
    `${iso}: ascending`,
    list.every((t, i) => i === 0 || rank(t) > rank(list[i - 1])),
    list.join(', '),
  )
}
check(
  'August 2026 leads with Fall 2026',
  laterTerms(6, new Date('2026-08-22T12:00:00'))[0] === 'Fall 2026',
  laterTerms(6, new Date('2026-08-22T12:00:00'))[0],
)

// ── sectionPatch ────────────────────────────────────────────────────────────
console.log('\nsectionPatch')
const sec = (o) => ({
  classNumber: '1',
  termCode: '2262',
  section: 'BB',
  courseTitle: '',
  component: 'LEC',
  componentLabel: 'Lecture',
  meetingTimes: null,
  enrolled: null,
  capacity: null,
  waitlisted: null,
  waitlistCap: null,
  hasReserved: false,
  location: '',
  instructionMode: '',
  building: '',
  room: '',
  ...o,
})

const lec = sec({
  classNumber: '1',
  section: 'BB',
  component: 'LEC',
  courseTitle: 'Object-Oriented Programming I',
  meetingTimes: 'Mon · Wed 10:15-11:30',
  building: 'H',
  room: '520',
})
const tut = sec({
  classNumber: '2',
  section: 'BI',
  component: 'TUT',
  meetingTimes: 'Fri 13:00-14:50',
  building: 'H',
  room: '937',
})

const both = sectionPatch([tut, lec]) // deliberately out of order
check('lecture leads the section string', both.section === 'BB LEC · BI TUT', both.section)
check(
  'patterns join with ; so parseMeetingTimes sees two',
  both.meetingTimes === 'Mon · Wed 10:15-11:30; Fri 13:00-14:50',
  both.meetingTimes,
)
check('rooms de-duplicate and join', both.location === 'H 520 · H 937', both.location)
check('title comes from whichever row has one', both.title === 'Object-Oriented Programming I')

// No building: "Online" is a real answer to "where is this", and a blank field
// reads as missing data rather than as a class that has no room.
const online = sectionPatch([sec({ instructionMode: 'Online', meetingTimes: 'Tue 18:00-20:30' })])
check('falls back to the instruction mode', online.location === 'Online', online.location)

// A TBA section must not wipe a schedule the student typed. sectionPatch reports
// the blank; the caller is what refuses to write it.
const tba = sectionPatch([sec({ section: 'AA', meetingTimes: null })])
check('no times published reports empty, not a guess', tba.meetingTimes === '', tba.meetingTimes)
check('title stays empty when none is published', tba.title === '')

check('sortSections puts LEC before TUT before LAB', (() => {
  const order = sortSections([
    sec({ classNumber: '3', component: 'LAB' }),
    tut,
    lec,
  ]).map((s) => s.component)
  return order.join(',') === 'LEC,TUT,LAB'
})())

console.log(failed === 0 ? '\ncourse-sections: all checks passed' : `\ncourse-sections: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
