// Node check for assignment reminders: the copy in both voices, and the plan
// the phone schedules. Run: node src/lib/reminders.test.mjs
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Bundled through esbuild with the `@` alias mapped (moodle-match uses it);
// the Capacitor plugins are stubbed out: planReminders never touches them.
const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.reminders.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'assignment-reminders.ts')}" --format=esm "--alias:@=./src" --external:@capacitor/* --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { planReminders } = await import(pathToFileURL(out).href)
const { reminderCopy, leadPhrase, mergeOffsets } = await import(pathToFileURL(path.join(here, 'reminder-copy.ts')).href)

let fails = 0
function ok(name, cond) {
  if (cond) console.log(`  ok    ${name}`)
  else {
    fails++
    console.log(`  FAIL  ${name}`)
  }
}

console.log('copy')
const formal = reminderCopy({ tone: 'formal', title: 'Assignment 1', course: 'COMM 305', offsetMinutes: 60, seed: 'x' })
ok('formal reads exactly like the brief', formal.body === 'Assignment for COMM 305 - Assignment 1 is due in one hour.')
ok('formal title is the course', formal.title === 'COMM 305')
ok('phrases', leadPhrase(30) === '30 minutes' && leadPhrase(1440) === '1 day' && leadPhrase(2880) === '2 days' && leadPhrase(10080, true) === 'one week')
const cool = new Set()
for (let i = 0; i < 12; i++) {
  cool.add(reminderCopy({ tone: 'cool', title: 'Lab 3', course: 'COMP 248', offsetMinutes: 60, seed: `a${i}` }).body)
}
ok('cool varies across assignments (not one line every time)', cool.size >= 3)
const same1 = reminderCopy({ tone: 'cool', title: 'Lab 3', course: 'COMP 248', offsetMinutes: 60, seed: 'q' }).body
const same2 = reminderCopy({ tone: 'cool', title: 'Lab 3', course: 'COMP 248', offsetMinutes: 60, seed: 'q' }).body
ok('cool is stable for the same reminder', same1 === same2)
ok('cool names the assignment', same1.includes('Lab 3'))
const far = reminderCopy({ tone: 'cool', title: 'Essay', course: 'ENGL 233', offsetMinutes: 2880, seed: 'e' }).body
ok('far-out copy mentions the lead time', far.includes('2 days'))
ok('merge: defaults + own, deduped, farthest first', mergeOffsets([1440, 60], [60, 30]).join(',') === '1440,60,30')
ok('merge drops junk', mergeOffsets([0, -5, 99999, 60.5], [120]).join(',') === '120')

console.log('plan')
const now = Date.parse('2026-10-01T12:00:00Z')
const iso = (h) => new Date(now + h * 3_600_000).toISOString()
const courses = [{ id: 'c1', code: 'COMM 305' }]
const base = { id: 'a1', courseId: 'c1', title: 'Assignment 1', kind: 'assignment', weight: 10, provenance: { status: 'official' }, grade: null, notes: '' }
const plan = planReminders({
  now,
  enabled: true,
  defaults: [1440, 60],
  tone: 'formal',
  courses,
  tasks: [],
  assessments: [
    { ...base, due: iso(30), status: 'not-started', reminders: [30] },
    { ...base, id: 'a2', due: iso(30), status: 'done' },
    { ...base, id: 'a3', due: iso(-1), status: 'not-started' },
    { ...base, id: 'a4', due: null, status: 'not-started' },
  ],
})
ok('three reminders for the open one (1 day, 1 hour, its own 30 min)', plan.length === 3)
ok('none for done, past or undated', plan.every((p) => p.path.endsWith('focus=a1')))
ok('soonest first', plan[0].at < plan[1].at && plan[1].at < plan[2].at)
ok('1 day before lands 6h from now', plan[0].at.getTime() === now + 6 * 3_600_000)
ok('deep link opens the assignment', plan[0].path === '/app/courses/c1?focus=a1')
ok('ids are stable', plan[0].id === planReminders({ now, enabled: true, defaults: [1440, 60], tone: 'formal', courses, tasks: [], assessments: [{ ...base, due: iso(30), status: 'not-started', reminders: [30] }] })[0].id)
ok('already-passed moments are skipped', planReminders({ now, enabled: true, defaults: [1440], tone: 'cool', courses, tasks: [], assessments: [{ ...base, due: iso(2), status: 'not-started' }] }).length === 0)
ok('off means nothing', planReminders({ now, enabled: false, defaults: [60], tone: 'cool', courses, tasks: [], assessments: [{ ...base, due: iso(5), status: 'not-started' }] }).length === 0)
const many = Array.from({ length: 50 }, (_, i) => ({ ...base, id: `m${i}`, due: iso(48 + i), status: 'not-started' }))
ok('capped under the iOS limit of 64', planReminders({ now, enabled: true, defaults: [1440, 60], tone: 'cool', courses, tasks: [], assessments: many }).length === 60)
const moodle = planReminders({
  now, enabled: true, defaults: [60], tone: 'cool', courses, assessments: [],
  tasks: [{ id: 't1', title: 'Join a Group is due', due: iso(10), done: false, source: 'moodle', note: 'COMM-305-2262-B' }],
})
ok('an unpaired Moodle deadline is reminded too', moodle.length === 1 && moodle[0].body.includes('Join a Group'))

console.log(fails ? `\n${fails} failed` : '\nreminders: all checks passed')
process.exit(fails ? 1 : 0)
