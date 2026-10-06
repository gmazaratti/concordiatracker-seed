// node src/features/profile/chat/chat-time.test.mjs
import { timeDivider, timeLabel } from './chat-time.ts'

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`)
  if (!ok) failed++
}
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).toISOString()
const now = new Date(2026, 9, 6, 15, 0).getTime() // Tue Oct 6 2026, 3 PM

check('the first message of a thread gets a time', timeDivider(null, at(2026, 10, 6, 14, 0), now) !== null)
check('a reply ten minutes later does not', timeDivider(at(2026, 10, 6, 14, 0), at(2026, 10, 6, 14, 10), now) === null)
check('59 minutes later is still the same conversation', timeDivider(at(2026, 10, 6, 13, 0), at(2026, 10, 6, 13, 59), now) === null)
check('an hour later starts a new one', timeDivider(at(2026, 10, 6, 13, 0), at(2026, 10, 6, 14, 0), now) !== null)
check('today shows only the time', !/Yesterday|,/.test(timeLabel(at(2026, 10, 6, 2, 58), now)) && /2:58/.test(timeLabel(at(2026, 10, 6, 2, 58), now)))
check('yesterday says so', timeLabel(at(2026, 10, 5, 23, 0), now).startsWith('Yesterday'))
check('within the week shows the weekday', /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/.test(timeLabel(at(2026, 10, 2, 9, 0), now)))
check('older this year shows the date without the year', /Sep/.test(timeLabel(at(2026, 9, 20, 9, 0), now)) && !/2026/.test(timeLabel(at(2026, 9, 20, 9, 0), now)))
check('another year shows the year', /2025/.test(timeLabel(at(2025, 12, 20, 9, 0), now)))
check('a broken timestamp draws nothing', timeDivider(null, 'nonsense', now) === null)

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nchat time: all checks passed')
