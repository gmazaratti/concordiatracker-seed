// Node-run checks for the BIXI, library-hours and STM helpers (`npm run test:campus`).
import { readFileSync } from 'node:fs'
import { metres, nearestStations, readStations } from './bixi.ts'
import { montrealDay, parseLibraryHours } from './library-hours.ts'
import { feedExpired, nextDepartures, serviceRuns } from './stm.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}

// ── BIXI ─────────────────────────────────────────────────────────────────────
check('one block is about 100m', Math.abs(metres(45.4971, -73.5788, 45.4980, -73.5788) - 100) < 2)
const stations = [
  { station_id: '89', name: 'Mackay / de Maisonneuve', lat: 45.4973, lon: -73.5793 },
  { station_id: '1146', name: 'de Maisonneuve / Mackay', lat: 45.4977, lon: -73.5795 },
  { station_id: '999', name: 'Far away', lat: 45.55, lon: -73.6 },
  { station_id: 'x', name: 'Broken', lat: NaN, lon: -73.6 },
]
const near = nearestStations(stations, 45.4971, -73.5788)
check('nearest first, far and broken stations dropped', near.map((s) => s.id).join() === '89,1146', JSON.stringify(near))
const read = readStations(near, [
  { station_id: '89', num_bikes_available: 15, num_ebikes_available: 1, num_docks_available: 8, is_installed: 1, is_renting: 1, is_returning: 1 },
])
check('a station missing from status is dropped, not shown as zero', read.length === 1 && read[0].bikes === 15 && read[0].ebikes === 1 && read[0].docks === 8)
const closed = readStations(near, [{ station_id: '89', num_bikes_available: 0, num_docks_available: 0, is_installed: 0 }])
check('an uninstalled station reads as closed', closed[0]?.closed === true)

// ── Library hours ────────────────────────────────────────────────────────────
const libs = parseLibraryHours({
  locations: [
    { lid: 7428, name: 'Webster Library (Building)', category: 'library', times: { status: '24hours', currently_open: true }, rendered: '24 Hours' },
    { lid: 7431, name: 'Loans & Returns Desk', category: 'department', parent_lid: 7428, times: { status: 'open' }, rendered: '9am - 9pm' },
    { lid: 7429, name: 'Vanier Library (Building)', category: 'library', times: { status: 'closed', currently_open: false }, rendered: 'Closed' },
    { lid: 8502, name: 'Online Chat Service', category: 'library', rendered: '9am - 7pm' },
    { lid: 8508, name: 'Booking: Rooms and Computers', category: 'library', times: { status: 'not-set' } },
  ],
})
check('only the two library buildings', libs.map((l) => l.name).join() === 'Webster Library,Vanier Library', JSON.stringify(libs.map((l) => l.name)))
check('24-hour building', libs[0].hours === '24 hours' && libs[0].campus === 'SGW')
check('desk hours attached to its building', libs[0].desk?.hours === '9am – 9pm', JSON.stringify(libs[0].desk))
check('closed day', libs[1].hours === 'Closed' && libs[1].campus === 'Loyola')
check('garbage parses to nothing', parseLibraryHours({ nope: 1 }).length === 0 && parseLibraryHours(null).length === 0)
check('the cache day is Montreal’s, not UTC’s', montrealDay(new Date('2026-10-02T02:00:00Z')) === '2026-10-01')

// ── STM ──────────────────────────────────────────────────────────────────────
const data = {
  feed: { start: '20260615', end: '20261025' },
  stops: [
    { id: 'near', name: 'Sherbrooke / Bishop', campus: 'sgw', m: 150 },
    { id: 'next', name: 'Sherbrooke / Guy', campus: 'sgw', m: 240 },
    { id: 'metro', name: 'Station Guy-Concordia', campus: 'sgw', m: 175 },
  ],
  routes: { '24': { n: '24', name: 'Sherbrooke', c: null, t: 3 }, '1': { n: '1', name: 'Verte', c: '00B300', t: 1 } },
  services: {
    wk: { days: '0111110', start: '20260615', end: '20261025', add: [], remove: ['20261012'] },
    sat: { days: '0000001', start: '20260615', end: '20261025', add: ['20261012'], remove: [] },
  },
  lines: [
    { stop: 'near', route: '24', headsign: 'Est', svc: { wk: [600, 615], sat: [610] } },
    { stop: 'next', route: '24', headsign: 'Est', svc: { wk: [601, 616] } },
    { stop: 'metro', route: '1', headsign: 'Station Angrignon', svc: { wk: [602, 1445] } },
  ],
}
const thu = new Date('2026-10-01T10:00')
check('weekday service runs on a Thursday', serviceRuns(data.services.wk, thu))
check('a removed date does not run', !serviceRuns(data.services.wk, new Date('2026-10-12T10:00')))
check('an added date does', serviceRuns(data.services.sat, new Date('2026-10-12T10:00')))
const rows = nextDepartures(data, 'sgw', thu)
check('one row per route+direction, from the closest stop', rows.filter((r) => r.route === '24').length === 1 && rows.find((r) => r.route === '24').stop === 'Sherbrooke / Bishop', JSON.stringify(rows))
check('soonest first', rows[0].route === '24' && rows[0].next[0] === 0)
check('metro labelled by line colour name', rows.find((r) => r.route === '1')?.label === 'Green')
const late = nextDepartures(data, 'sgw', new Date('2026-10-02T00:03'))
check('a 24:05 trip from yesterday’s service counts after midnight', late.some((r) => r.route === '1' && r.next[0] === 2), JSON.stringify(late))
check('past the feed end it is expired', feedExpired(data, new Date('2026-10-26T09:00')) && !feedExpired(data, thu))

// The real built file, if present: it should answer for a Thursday afternoon.
try {
  const real = JSON.parse(readFileSync(new URL('../../public/data/stm-concordia.json', import.meta.url), 'utf8'))
  const anyDay = new Date(`${real.feed.start.slice(0, 4)}-${real.feed.start.slice(4, 6)}-${real.feed.start.slice(6)}T16:30`)
  check('built file: departures at SGW', nextDepartures(real, 'sgw', anyDay).length > 0)
  check('built file: departures at Loyola', nextDepartures(real, 'loy', anyDay).length > 0)
} catch (e) {
  check('built file readable', false, String(e))
}

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\ncampus feeds: all checks passed')
