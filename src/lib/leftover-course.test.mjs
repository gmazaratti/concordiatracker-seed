// node src/lib/leftover-course.test.mjs  (TKT-1034)
import { currentTermStart, looksFinished } from './leftover-course.ts'

let failed = 0
const check = (name, ok) => {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name}`)
  }
}

const sept28 = new Date(2026, 8, 28)
check('Fall starts Sep 1', currentTermStart(sept28).getTime() === new Date(2026, 8, 1).getTime())
check('Winter starts Jan 1', currentTermStart(new Date(2026, 2, 5)).getMonth() === 0)
check('Summer starts May 1', currentTermStart(new Date(2026, 6, 5)).getMonth() === 4)

// The reported case: Fall classes filed under Summer, no grade.
check('no assessments, no grade → stays current', !looksFinished({ dues: [] }, sept28))
check('undated only → stays current', !looksFinished({ dues: [null, ''] }, sept28))
check(
  'Fall-dated work → stays current (THEO 202)',
  !looksFinished({ dues: ['2026-09-18T12:00:00Z', '2026-12-15T12:00:00Z'] }, sept28),
)
check(
  'one date in this term is enough to stay',
  !looksFinished({ dues: ['2026-07-01T12:00:00Z', '2026-09-10T12:00:00Z'] }, sept28),
)

// Genuine leftovers.
check('final percent → finished', looksFinished({ finalPercent: 77, dues: [] }, sept28))
check('final letter → finished', looksFinished({ finalLetter: 'B+', dues: [] }, sept28))
check('blank letter is not a grade', !looksFinished({ finalLetter: '  ', dues: [] }, sept28))
check(
  'all work before the term → finished',
  looksFinished({ dues: ['2026-06-01T12:00:00Z', '2026-08-10T12:00:00Z'] }, sept28),
)
check('garbage date ignored', !looksFinished({ dues: ['not a date'] }, sept28))

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nleftover-course: all passed')
