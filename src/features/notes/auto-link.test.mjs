// node src/features/notes/auto-link.test.mjs
import { autoLinkFor, slotsOf, weekOfTerm } from './auto-link.ts'

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`)
  if (!ok) failed++
}

const term = { start: '2026-09-02T00:00:00', end: '2026-12-01T23:59:59' }
const courses = [
  { id: 'fina210', code: 'FINA 210', meetingTimes: 'Tue · Thu 10:15–11:30' },
  { id: 'comm305', code: 'COMM 305', meetingTimes: 'Mon 13:00–15:30; Wed 08:45–10:00' },
  { id: 'manual-1', code: 'RELI 230', meetingTimes: 'TBA' },
  { id: 'none', code: 'COMP 248' },
]
// Tuesday Sep 29 2026 is in week 4 (Sep 2 + 27 days).
const at = (iso) => new Date(iso)

check('parses two patterns', slotsOf(courses[1].meetingTimes).length === 2)
check('TBA parses to nothing', slotsOf('TBA').length === 0)
check('missing meeting times parse to nothing', slotsOf(undefined).length === 0)

check('week 1 on the first day', weekOfTerm(at('2026-09-02T09:00:00'), term.start, term.end) === 1)
check('week 5 a month in', weekOfTerm(at('2026-09-30T09:00:00'), term.start, term.end) === 5)
check('no week before term', weekOfTerm(at('2026-08-20T09:00:00'), term.start, term.end) === null)
check('no week after term', weekOfTerm(at('2026-12-20T09:00:00'), term.start, term.end) === null)

const inClass = autoLinkFor(courses, at('2026-09-29T10:40:00'), term)
check('Tuesday 10:40 links FINA 210', inClass?.courseId === 'fina210', JSON.stringify(inClass))
check('title is "Week 4 FINA 210"', inClass?.title === 'Week 4 FINA 210', inClass?.title)
check('lecture date is local', inClass?.lectureDate === '2026-09-29', inClass?.lectureDate)

check('ten minutes early still counts', autoLinkFor(courses, at('2026-09-29T10:06:00'), term)?.courseId === 'fina210')
check('eleven minutes early does not', autoLinkFor(courses, at('2026-09-29T10:04:00'), term) === null)
check('fifteen minutes late still counts', autoLinkFor(courses, at('2026-09-29T11:45:00'), term)?.courseId === 'fina210')
check('sixteen minutes late does not', autoLinkFor(courses, at('2026-09-29T11:46:00'), term) === null)
check('wrong day does not link', autoLinkFor(courses, at('2026-09-28T10:40:00'), term) === null)
check('Monday afternoon links COMM 305', autoLinkFor(courses, at('2026-09-28T14:00:00'), term)?.courseId === 'comm305')

const overlap = [
  { id: 'a', code: 'AAA 100', meetingTimes: 'Tue 10:00–12:00' },
  { id: 'b', code: 'BBB 200', meetingTimes: 'Tue 11:00–12:00' },
]
check('overlap picks the class that started last', autoLinkFor(overlap, at('2026-09-29T11:05:00'), term)?.courseId === 'b')

const outside = autoLinkFor(courses, at('2026-12-15T10:40:00'), term)
check('outside term: still links, no week', outside?.courseId === 'fina210' && outside.week === null)
check('outside term title has no week', outside?.title === 'FINA 210 lecture', outside?.title)

console.log(failed ? `\nauto-link: ${failed} failed` : '\nauto-link: all checks passed')
process.exit(failed ? 1 : 0)
