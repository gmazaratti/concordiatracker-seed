/**
 * Run: node --experimental-strip-types src/features/calendar/task-repeat.test.mjs
 * (wired into `npm test` as test:repeat)
 *
 * The DST cases are the reason this file exists. Adding 24h of milliseconds
 * passes every test you would write by eye in July and quietly moves a study
 * block by an hour for half the term.
 */
import { repeatOccurrences, describeRepeat, MAX_OCCURRENCES } from './task-repeat.ts'

let failed = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label}` +
      (ok ? '' : `\n         expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  )
}

/** Local wall-clock parts, which is what a person sees on the row. */
const local = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const at = (y, m, d, h = 20, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).toISOString()

console.log('\ntask-repeat')

check('no repeat is the one day', repeatOccurrences(at(2026, 10, 5), 'none', at(2026, 10, 30)).length, 1)

const daily = repeatOccurrences(at(2026, 10, 5, 20), 'daily', at(2026, 10, 9))
check('daily covers the range inclusively', daily.length, 5)
check('  first is the start', local(daily[0]), '2026-10-05 20:00')
check('  last is the until day', local(daily[4]), '2026-10-09 20:00')

const wk = repeatOccurrences(at(2026, 10, 5, 9), 'weekly', at(2026, 11, 2))
check('weekly steps seven days', wk.map(local), [
  '2026-10-05 09:00',
  '2026-10-12 09:00',
  '2026-10-19 09:00',
  '2026-10-26 09:00',
  '2026-11-02 09:00',
])

// Mon 5 Oct 2026 → Fri 16 Oct: ten weekdays, no Sat/Sun.
const wd = repeatOccurrences(at(2026, 10, 5, 18), 'weekdays', at(2026, 10, 16))
check('weekdays skips the weekend', wd.length, 10)
check('  and none of them is a weekend', wd.filter((i) => [0, 6].includes(new Date(i).getDay())).length, 0)

// A weekdays rule starting on a Saturday must still produce something.
const satStart = repeatOccurrences(at(2026, 10, 10, 12), 'weekdays', at(2026, 10, 10))
check('a weekend-only weekdays rule still returns the day asked for', satStart.length, 1)

/* ── DST: the whole point ──────────────────────────────────────────────────
 * North American DST ends 1 Nov 2026. A daily 8 PM block across it must stay
 * 8 PM every single day. (Skipped where the host has no DST, so this passes
 * in CI on UTC without pretending to have proved anything.) */
const hasDst = new Date(2026, 0, 1).getTimezoneOffset() !== new Date(2026, 6, 1).getTimezoneOffset()
if (hasDst) {
  const across = repeatOccurrences(at(2026, 10, 30, 20), 'daily', at(2026, 11, 3))
  check('every day across the DST change is still 20:00 local', [...new Set(across.map((i) => local(i).slice(11)))], ['20:00'])
  check('  and the instants are not all 24h apart', new Set(
    across.slice(1).map((iso, i) => new Date(iso).getTime() - new Date(across[i]).getTime()),
  ).size, 2)
} else {
  console.log('  --    DST checks skipped: this machine has no daylight saving')
}

const capped = repeatOccurrences(at(2026, 1, 1), 'daily', at(2027, 1, 1))
check('a year of dailies is capped', capped.length, MAX_OCCURRENCES)
check('  and the summary says so', describeRepeat(at(2026, 1, 1), 'daily', at(2027, 1, 1)).includes('most we add'), true)
check('no repeat has no summary', describeRepeat(at(2026, 1, 1), 'none', at(2027, 1, 1)), null)

check('an until BEFORE the start still gives the start day', repeatOccurrences(at(2026, 10, 5), 'daily', at(2026, 10, 1)).length, 1)
check('garbage in is not a crash', repeatOccurrences('not-a-date', 'daily', at(2026, 10, 1)), [])

console.log(failed === 0 ? '\ntask-repeat: all checks passed' : `\ntask-repeat: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
