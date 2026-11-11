// node src/lib/discovery.test.mjs
// The engine must name the RIGHT feature for a given student, and must not nag.
import { candidates, rank, popupFor, cardFor } from './discovery.ts'

let failures = 0
const check = (label, ok, detail) => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `\n         ${detail}`}`)
}
const eq = (label, got, want) => check(label, JSON.stringify(got) === JSON.stringify(want), `want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)

const usedAll = { account_days: 30, schedule: true, seat_watch: true, calendar_sync: true, moodle: true, notes: true, clubs: true, family: true, programme: true, scanned: true }
const usedNone = { account_days: 3, schedule: false, seat_watch: false, calendar_sync: false, moodle: false, notes: false, clubs: false, family: false, programme: false, scanned: false }
const base = {
  usage: usedAll, currentCourses: 4, emptyCourse: null, pastCourses: 6, gradedCount: 5, ungradedCourse: null,
  gpa: 3.4, weakest: { id: 'c1', code: 'COMM 305', percent: 81 }, upcomingDated: 5, hasReminders: true,
  personalTasks: 3, pro: true, atConcordia: true, desktop: true, month: 9,
}
const NOW = Date.parse('2026-10-14T15:00:00Z')
const top = (s, st = {}) => rank(s, st, NOW)[0]?.id

console.log('who gets what')
eq('an empty course outranks everything', top({ ...base, usage: usedNone, emptyCourse: { id: 'c9', code: 'FINA 210' }, pastCourses: 0 }), 'scan')
eq('a failing class gets the grade calculator', top({ ...base, weakest: { id: 'c1', code: 'COMM 305', percent: 52 } }), 'grade-needed')
eq('a low GPA gets the what-if', top({ ...base, gpa: 2.1 }), 'what-if')
eq('no past courses gets the past-courses nudge', top({ ...base, pastCourses: 0 }), 'past')
check('entering a grade is never a nudge (it is the premise, not a discovery)', !candidates({ ...base, usage: usedNone, gradedCount: 0, gpa: null, weakest: null, ungradedCourse: { id: 'c2', code: 'RELI 230' } }).some((n) => n.id === 'grade'))
eq('Moodle leads for a set-up account that never connected it', top({ ...base, usage: { ...usedAll, moodle: false } }), 'moodle')
eq('registration month promotes the schedule builder', top({ ...base, month: 10, usage: { ...usedAll, schedule: false } }), 'schedule')
check('outside registration the schedule builder is a low priority', rank({ ...base, month: 9, usage: { ...usedAll, schedule: false } }, {}, NOW)[0].score < 50)
eq('a student who uses everything hears nothing urgent', rank(base, {}, NOW).filter((n) => n.score >= 50).map((n) => n.id), [])

const noClubs = { ...base, usage: { ...usedAll, clubs: false } }
check('without a goal, clubs is not the top suggestion', top(noClubs) !== 'clubs')
eq('picking "find my people" in onboarding puts clubs first', top({ ...noClubs, goals: ['people'] }), 'clubs')
check('a goal never invents a nudge for something already used', !rank({ ...base, goals: ['parents'] }, {}, NOW).some((n) => n.id === 'family'))

console.log('what is never offered')
check('Concordia-only features are hidden from other schools', !candidates({ ...base, usage: usedNone, atConcordia: false }).some((n) => ['moodle', 'schedule', 'seat-watch', 'programme'].includes(n.id)))
check('Notes is not offered on a phone', !candidates({ ...base, usage: usedNone, desktop: false }).some((n) => n.id === 'notes'))
check('nothing usage-based is offered before usage loads', !candidates({ ...base, usage: null }).some((n) => n.id === 'moodle'))
check('every nudge carries a reason and an in-app link', candidates({ ...base, usage: usedNone, pastCourses: 0, emptyCourse: { id: 'x', code: 'A 1' } }).every((n) => n.reason && n.to.startsWith('/app')))

console.log('state: dismiss, tried, snooze')
const lowGpa = { ...base, gpa: 2.1 }
eq('dismissed is gone for good', top(lowGpa, { dismissed: ['what-if'] }) === 'what-if', false)
eq('tried counts as used', top(lowGpa, { tried: ['what-if'] }) === 'what-if', false)
eq('snoozed hides it until the time passes', top(lowGpa, { snoozed: { 'what-if': '2026-10-16T00:00:00Z' } }) === 'what-if', false)
eq('and it comes back after', top(lowGpa, { snoozed: { 'what-if': '2026-10-13T00:00:00Z' } }), 'what-if')

console.log('popups do not nag')
eq('never on the first day', popupFor(lowGpa, {}, 1, NOW), null)
eq('second day: the best match', popupFor(lowGpa, {}, 2, NOW)?.id, 'what-if')
eq('not twice in a day', popupFor({ ...lowGpa, pastCourses: 0 }, { popped: { 'what-if': '2026-10-14T09:00:00Z' }, lastPop: '2026-10-14T09:00:00Z' }, 3, NOW), null)
eq('next day: a different feature, never the same one', popupFor({ ...lowGpa, pastCourses: 0 }, { popped: { 'what-if': '2026-10-13T09:00:00Z' }, lastPop: '2026-10-13T09:00:00Z' }, 3, NOW)?.id, 'past')
eq('the gap grows after several', popupFor({ ...lowGpa, pastCourses: 0, usage: usedNone }, { popped: { a: 'x', b: 'x', c: 'x' }, lastPop: '2026-10-12T15:00:00Z' }, 6, NOW), null)
eq('weak matches never pop up', popupFor(base, {}, 5, NOW), null)

console.log('the card and the popup never share a day')
eq('no card on a day a popup showed', cardFor({ ...lowGpa, pastCourses: 0 }, { popped: { 'what-if': '2026-10-14T13:00:00Z' }, lastPop: '2026-10-14T13:00:00Z' }, NOW), null)
eq('the card is back the next day', cardFor({ ...lowGpa, pastCourses: 0 }, { popped: { 'what-if': '2026-10-13T09:00:00Z' }, lastPop: '2026-10-13T09:00:00Z' }, NOW)?.id, 'what-if')

console.log(failures === 0 ? '\ndiscovery: all checks passed' : `\ndiscovery: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
