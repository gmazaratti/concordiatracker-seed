// Node-run checks for lib/shuttle-parse.ts and data/shuttle.ts (`npm run test:shuttle`).
import { parseDays, parseRange, parseShuttlePage, parseTime } from './shuttle-parse.ts'
import { SHUTTLE_PERIODS, mergePeriods, nextDepartures, nextPeriod, periodFor } from '../data/shuttle.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}

// ── The pieces ───────────────────────────────────────────────────────────────
check('range across months', JSON.stringify(parseRange('Sep. 8 – Oct. 9, 2026')) === '{"from":"2026-09-08","to":"2026-10-09"}')
check('range within a month', JSON.stringify(parseRange('Oct. 13 – 16, 2026')) === '{"from":"2026-10-13","to":"2026-10-16"}')
check('range wrapping the new year', JSON.stringify(parseRange('Dec. 15 – Jan. 9, 2027')) === '{"from":"2026-12-15","to":"2027-01-09"}')
check('"Sept." spelling', parseRange('Sept. 8 – Oct. 9, 2026')?.from === '2026-09-08')
check('undatable text is null', parseRange('Fall term') === null)
check('Monday — Thursday', JSON.stringify(parseDays('Monday — Thursday')) === '[1,2,3,4]')
check('Tuesday — Friday', JSON.stringify(parseDays('Tuesday — Friday')) === '[2,3,4,5]')
check('Friday', JSON.stringify(parseDays('Friday')) === '[5]')
check('time with a footnote star', parseTime('18:30*') === '18:30')
check('time with "p.m."', parseTime('18:45 p.m.') === '18:45')
check('single-digit hour padded', parseTime('9:15') === '09:15')
check('a blank cell is not a time', parseTime(' ') === null)

// ── A page shaped like the real one ──────────────────────────────────────────
const table = (days, rows) =>
  `<table><tbody><tr><th colspan="2">${days}</th></tr><tr><th><b>LOY departures</b></th><th><b>S.G.W departures</b></th></tr>` +
  rows.map(([l, s]) => `<tr><td>${l}</td><td>${s}</td></tr>`).join('') +
  `<tr><td colspan="2"><p><b>*Last bus/Dernier départ. Loyola 18:30</b></p></td></tr></tbody></table>`
const page =
  `<script>var x = "<h2>Not a heading</h2>"</script><h2>Campus bus stops</h2><p>Loyola Chapel</p>` +
  `<h2>Fall departure times</h2><p>Schedule in effect: <b>Sep. 8 – Oct. 9, 2026</b></p>` +
  table('Monday — Thursday', [['9:15', '9:30'], ['9:30', '9:45'], ['18:30*', '&nbsp;']]) +
  table('Friday', [['9:15', '9:45']]) +
  `<h2>Reading Week schedule departure times</h2><p>Schedule in effect:&nbsp;Oct. 13 – 16, 2026</p>` +
  `<p>No service on Monday, October 12, 2026</p>` +
  table('Tuesday — Friday', [['9:15', '9:15'], ['18:45 p.m.', '18:45']]) +
  `<h2>Shuttle regulations</h2><p>ID required.</p>`

const parsed = parseShuttlePage(page)
check('two dated periods, the rest ignored', parsed.length === 2, JSON.stringify(parsed.map((p) => p.label)))
check('labels', parsed[0]?.label === 'Fall' && parsed[1]?.label === 'Reading Week', JSON.stringify(parsed.map((p) => p.label)))
check('fall dates', parsed[0]?.validFrom === '2026-09-08' && parsed[0]?.validTo === '2026-10-09')
check('stops keep their own times', JSON.stringify(parsed[0]?.services[0].departures) === '{"sgw":["09:30","09:45"],"loy":["09:15","09:30","18:30"]}', JSON.stringify(parsed[0]?.services[0].departures))
check('friday table', JSON.stringify(parsed[0]?.services[1].days) === '[5]')
check('reading week Tue–Fri', JSON.stringify(parsed[1]?.services[0].days) === '[2,3,4,5]')
check('a page with no timetable parses to nothing', parseShuttlePage('<h2>Shuttle</h2><p>Coming soon</p>').length === 0)

// ── The widget's logic ───────────────────────────────────────────────────────
const at = (s) => new Date(s)
check('bundled data covers today (Oct 1 2026)', periodFor(at('2026-10-01T12:00'))?.label === 'Fall')
const thu = nextDepartures('loy', at('2026-10-01T09:20'), 2)
check('Loyola Thursday 9:20 → 9:30, 9:45', JSON.stringify(thu.next.map((d) => d.time)) === '["09:30","09:45"]', JSON.stringify(thu.next))
const sgw = nextDepartures('sgw', at('2026-10-01T09:20'), 1)
check('SGW Thursday 9:20 → 9:30', sgw.next[0]?.time === '09:30', JSON.stringify(sgw.next))
const fri = nextDepartures('sgw', at('2026-10-02T09:00'), 1)
check('SGW Friday uses the Friday table → 9:45', fri.next[0]?.time === '09:45', JSON.stringify(fri.next))
check('Saturday has no service', nextDepartures('sgw', at('2026-10-03T10:00')).noServiceToday)
check('Thanksgiving Monday is between periods', periodFor(at('2026-10-12T10:00')) === null)
check('…and names the reading-week schedule next', nextPeriod(at('2026-10-12T10:00'))?.label === 'Reading Week')
check('after the last bus', nextDepartures('sgw', at('2026-10-01T19:00')).doneForToday)

const fetched = [{ label: 'Fall', validFrom: '2026-09-08', validTo: '2026-10-09', services: [{ days: [1], departures: { sgw: ['08:00'], loy: ['08:00'] } }] }]
const merged = mergePeriods(SHUTTLE_PERIODS, fetched)
check('a fetched period replaces the bundled one it overlaps', merged.filter((p) => p.label === 'Fall').length === 1 && periodFor(at('2026-09-14T07:00'), merged).services[0].departures.sgw[0] === '08:00')
check('bundled periods the page no longer lists are kept', merged.some((p) => p.label === 'Summer') && merged.some((p) => p.label === 'Reading Week'))

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nshuttle: all checks passed')
