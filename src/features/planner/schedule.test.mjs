/**
 * The schedule builder's arithmetic, checked without rendering a grid.
 *
 *   node src/features/planner/schedule.test.mjs
 *
 * Two rules here are judgement calls rather than obvious facts, so they are
 * pinned: touching classes are NOT a conflict, and an unknown campus is not
 * treated as a different one. Getting either wrong produces warnings on
 * timetables that are perfectly fine, which trains people to ignore all of them.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..', '..')
const out = path.join(here, '.schedule.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'schedule.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: root },
)
const { placeSections, findConflicts, findCampusGaps, weeklyHours, daysOff, gridBounds } =
  await import(pathToFileURL(out).href)

let bad = 0
const eq = (label, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) bad++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`}`) }

const sec = (classNumber, meetingTimes, location = 'SGW') =>
  ({ classNumber, meetingTimes, location, section: 'A', component: 'LEC' })

console.log('\nplacing sections on the week')
eq('one pattern, two days', placeSections([{ code: 'COMP 248', section: sec('1', 'Mon · Wed 10:15–11:30') }]).length, 2)
eq('two patterns (lecture + tutorial)',
  placeSections([{ code: 'COMP 248', section: sec('1', 'Mon · Wed 10:15–11:30; Fri 13:15–14:05') }]).length, 3)
eq('an unparseable time places nothing', placeSections([{ code: 'X', section: sec('1', 'TBA') }]).length, 0)

console.log('\nconflicts')
const clash = placeSections([
  { code: 'A 100', section: sec('1', 'Mon 10:00–11:30') },
  { code: 'B 200', section: sec('2', 'Mon 11:00–12:30') },
])
eq('overlapping classes are flagged', findConflicts(clash).length, 1)
eq('and by how much', findConflicts(clash)[0].minutes, 30)

const touching = placeSections([
  { code: 'A 100', section: sec('1', 'Mon 10:00–11:30') },
  { code: 'B 200', section: sec('2', 'Mon 11:30–13:00') },
])
// Back-to-back is normal. Flagging it would warn on half of every real timetable.
eq('touching is NOT a conflict', findConflicts(touching).length, 0)

const otherDay = placeSections([
  { code: 'A 100', section: sec('1', 'Mon 10:00–11:30') },
  { code: 'B 200', section: sec('2', 'Tue 10:00–11:30') },
])
eq('same time, different day, no conflict', findConflicts(otherDay).length, 0)

const sameSection = placeSections([{ code: 'A 100', section: sec('1', 'Mon 10:00–11:30; Mon 11:00–12:00') }])
eq('a section cannot clash with itself', findConflicts(sameSection).length, 0)

console.log('\ncross-campus gaps')
const tight = placeSections([
  { code: 'A 100', section: sec('1', 'Mon 10:00–11:30', 'SGW') },
  { code: 'B 200', section: sec('2', 'Mon 11:45–13:00', 'LOY') },
])
eq('15 minutes between campuses is flagged', findCampusGaps(tight).length, 1)
eq('with the gap in minutes', findCampusGaps(tight)[0].minutes, 15)

const roomy = placeSections([
  { code: 'A 100', section: sec('1', 'Mon 10:00–11:30', 'SGW') },
  { code: 'B 200', section: sec('2', 'Mon 13:00–14:00', 'LOY') },
])
eq('90 minutes is enough', findCampusGaps(roomy).length, 0)

const sameCampus = placeSections([
  { code: 'A 100', section: sec('1', 'Mon 10:00–11:30', 'SGW') },
  { code: 'B 200', section: sec('2', 'Mon 11:45–13:00', 'SGW') },
])
eq('same campus is never a shuttle problem', findCampusGaps(sameCampus).length, 0)

const unknown = placeSections([
  { code: 'A 100', section: sec('1', 'Mon 10:00–11:30', '') },
  { code: 'B 200', section: sec('2', 'Mon 11:45–13:00', 'LOY') },
])
// A blank campus is unknown, not "different". Guessing produces warnings nobody
// can act on.
eq('an unknown campus is not flagged', findCampusGaps(unknown).length, 0)

console.log('\nsummary numbers')
const week = placeSections([
  { code: 'A 100', section: sec('1', 'Mon · Wed 10:00–11:30') },
  { code: 'B 200', section: sec('2', 'Tue 14:00–15:00') },
])
eq('weekly hours', weeklyHours(week), 4)
eq('days off', daysOff(week), [4, 5])
eq('grid starts on the hour', gridBounds(week).start, 600)
eq('grid ends on the hour', gridBounds(week).end, 900)
eq('an empty week still has a sane grid', gridBounds([]), { start: 480, end: 1080 })

console.log(bad === 0 ? '\nAll checks passed.' : `\n${bad} FAILED.`)
process.exit(bad ? 1 : 0)
