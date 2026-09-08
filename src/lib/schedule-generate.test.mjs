/**
 * The schedule generator.
 *
 *   node src/lib/schedule-generate.test.mjs
 *
 * Everything here guards a failure the student cannot see by looking: a
 * timetable with two classes in the same hour looks fine until week one, a
 * "different" draft that is secretly the same one makes the cycle button feel
 * broken, and a pin that quietly moves is worse than no pin at all.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const out = path.join(here, '.schedgen.tmp.mjs')
execSync(
  `npx esbuild "${path.join(root, 'src/lib/schedule-generate.ts')}" --bundle --format=esm --alias:@=./src --outfile="${out}"`,
  { stdio: 'pipe', cwd: root },
)
const { generateSchedules, toCombos } = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

let n = 0
const sec = (meetingTimes, component = 'LEC') => ({
  classNumber: `s${++n}`,
  termCode: '2262',
  section: 'AA',
  courseTitle: '',
  component,
  componentLabel: component,
  meetingTimes,
  enrolled: null,
  capacity: null,
  waitlisted: null,
  waitlistCap: null,
  hasReserved: false,
  location: '',
  instructionMode: '',
  building: 'H',
  room: '520',
})

const course = (code, credits, times) => ({
  code,
  title: code,
  credits,
  combos: times.map((t) => [sec(t)]),
})

console.log('\ntoCombos')
{
  const combos = toCombos([
    sec('Mon 09:00-10:15', 'LEC'),
    sec('Tue 09:00-10:15', 'LEC'),
    sec('Wed 13:00-14:15', 'TUT'),
    sec('Thu 13:00-14:15', 'TUT'),
  ])
  check('pairs each lecture with each tutorial', combos.length === 4, String(combos.length))
  check('every combo has one of each component', combos.every((c) => c.length === 2))
  check('the lecture leads', combos.every((c) => c[0].component === 'LEC'))
}
{
  const combos = toCombos([sec('Mon 09:00-10:15', 'LEC'), sec('Mon 09:00-10:15', 'TUT')])
  check('drops self-conflicting combinations', combos.length === 0, String(combos.length))
}

console.log('\ngenerateSchedules — the thing that must never happen')
{
  const candidates = [
    course('AAA 100', 3, ['Mon 09:00-10:15', 'Tue 09:00-10:15']),
    course('BBB 200', 3, ['Mon 09:00-10:15', 'Wed 09:00-10:15']),
    course('CCC 300', 3, ['Mon 09:00-10:15', 'Thu 09:00-10:15']),
  ]
  const results = generateSchedules({ candidates, pinned: [], blocks: [], targetCredits: 9 })
  check('produced something', results.length > 0)
  const overlapping = results.filter((r) => {
    const slots = r.picks.flatMap((p) => p.sections.map((s) => s.meetingTimes))
    return slots.some((a, i) => slots.some((b, j) => i !== j && a === b))
  })
  check('NO schedule double-books an hour', overlapping.length === 0, `${overlapping.length} bad`)
  check('reaches the credit target', results[0].credits === 9, String(results[0].credits))
}

console.log('\npins')
{
  const pinnedSection = sec('Fri 08:00-09:15')
  const candidates = [
    { code: 'PIN 101', title: 'PIN 101', credits: 3, combos: [[pinnedSection]] },
    course('AAA 100', 3, ['Mon 09:00-10:15', 'Tue 09:00-10:15', 'Wed 09:00-10:15']),
    course('BBB 200', 3, ['Mon 13:00-14:15', 'Tue 13:00-14:15', 'Thu 13:00-14:15']),
  ]
  const results = generateSchedules({
    candidates,
    pinned: [{ code: 'PIN 101', sections: [pinnedSection] }],
    blocks: [],
    targetCredits: 9,
    count: 5,
  })
  check('every draft keeps the pin', results.every((r) => r.picks.some((p) => p.code === 'PIN 101')))
  check(
    'and keeps it in the SAME slot',
    results.every(
      (r) => r.picks.find((p) => p.code === 'PIN 101')?.sections[0].meetingTimes === 'Fri 08:00-09:15',
    ),
  )
  check(
    'the pin is marked as pinned',
    results.every((r) => r.picks.find((p) => p.code === 'PIN 101')?.pinned === true),
  )
}

console.log('\nblocked time')
{
  const candidates = [course('AAA 100', 3, ['Mon 09:00-10:15', 'Thu 15:00-16:15'])]
  const results = generateSchedules({
    candidates,
    pinned: [],
    blocks: [{ id: 'b1', day: 1, start: '08:00', end: '12:00', label: 'Work' }],
    targetCredits: 3,
    count: 4,
  })
  check(
    'never schedules into a blocked morning',
    results.every((r) =>
      r.picks.every((p) => p.sections.every((s) => !s.meetingTimes.startsWith('Mon'))),
    ),
  )
  check('still finds the Thursday option', results.length > 0 && results[0].picks.length === 1)
}

console.log('\ndistinct drafts')
{
  const candidates = [
    course('AAA 100', 3, ['Mon 09:00-10:15', 'Tue 09:00-10:15', 'Wed 09:00-10:15']),
    course('BBB 200', 3, ['Mon 13:00-14:15', 'Tue 13:00-14:15', 'Thu 13:00-14:15']),
  ]
  const results = generateSchedules({
    candidates,
    pinned: [],
    blocks: [],
    targetCredits: 6,
    count: 5,
  })
  const ids = new Set(results.map((r) => r.id))
  check(
    'no two drafts are the same set of sections',
    ids.size === results.length,
    `${ids.size} vs ${results.length}`,
  )
  check('more than one was found', results.length > 1, String(results.length))
}

console.log('\nrequested courses and warnings')
{
  const candidates = [
    {
      code: 'WANT 400',
      title: 'WANT 400',
      credits: 3,
      combos: [[sec('Mon 09:00-10:15')]],
      requested: true,
    },
    course('FILL 100', 3, ['Tue 09:00-10:15']),
    course('FILL 200', 3, ['Wed 09:00-10:15']),
    course('FILL 300', 3, ['Thu 09:00-10:15']),
  ]
  const r = generateSchedules({ candidates, pinned: [], blocks: [], targetCredits: 6, count: 3 })
  check(
    'a requested course is always included',
    r.every((x) => x.picks.some((p) => p.code === 'WANT 400')),
  )
}
{
  const candidates = [
    {
      code: 'WANT 400',
      title: 'WANT 400',
      credits: 3,
      combos: [[sec('Mon 09:00-10:15')]],
      requested: true,
    },
  ]
  const r = generateSchedules({
    candidates,
    pinned: [],
    blocks: [{ id: 'b', day: 1, start: '08:00', end: '12:00', label: 'Work' }],
    targetCredits: 3,
    count: 2,
  })
  check(
    'says so when a requested course cannot be fitted',
    r.length === 0 || r[0].warnings.some((w) => w.kind === 'unplaceable'),
  )
}
{
  const r = generateSchedules({
    candidates: [course('ONE 100', 3, ['Mon 09:00-10:15'])],
    pinned: [],
    blocks: [],
    targetCredits: 15,
  })
  check('warns when it cannot reach the target', r[0].warnings.some((w) => w.kind === 'under-target'))
  check('and reports the real number', r[0].credits === 3, String(r[0].credits))
}

console.log('\ndays off')
{
  const r = generateSchedules({
    candidates: [course('AAA 100', 3, ['Mon 09:00-10:15'])],
    pinned: [],
    blocks: [],
    targetCredits: 3,
  })
  check('reports the four free weekdays', r[0].daysOff.join(',') === '2,3,4,5', r[0].daysOff.join(','))
}

console.log('\ndeterminism')
{
  const candidates = [
    course('AAA 100', 3, ['Mon 09:00-10:15', 'Tue 09:00-10:15']),
    course('BBB 200', 3, ['Wed 13:00-14:15', 'Thu 13:00-14:15']),
  ]
  const a = generateSchedules({ candidates, pinned: [], blocks: [], targetCredits: 6, seed: 42 })
  const b = generateSchedules({ candidates, pinned: [], blocks: [], targetCredits: 6, seed: 42 })
  check(
    'the same seed gives the same answer',
    JSON.stringify(a.map((x) => x.id)) === JSON.stringify(b.map((x) => x.id)),
  )
}

console.log(
  failed === 0 ? '\nschedule-generate: all checks passed' : `\nschedule-generate: ${failed} FAILED`,
)
process.exit(failed === 0 ? 0 : 1)
