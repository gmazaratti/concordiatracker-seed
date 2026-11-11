// node api/_digest-copy.test.mjs — the digest subject lines, per case.
import { digestSubject, agendaParts, dayWord } from './_digest-copy.ts'

// Monday Nov 16 2026, 9:00 Montreal (14:00 UTC).
const now = Date.parse('2026-11-16T14:00:00Z')
const it = (course, title, due) => ({ course, title, due })
const tue = it('RELI 230', 'Midterm', '2026-11-18T04:59:00Z') // Tue 23:59 local
const wed = it('COMM 305', 'Assignment 3', '2026-11-19T04:59:00Z')
const today = it('FINA 210', 'Quiz 4', '2026-11-16T23:00:00Z')
let fail = 0
const eq = (label, got, want) => {
  const ok = got === want
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`)
}
eq('tomorrow by name', dayWord(tue.due, now), 'tomorrow')
eq('a 23:59 deadline stays on its own day (not UTC)', dayWord(wed.due, now), 'Wednesday')
eq('nothing due', digestSubject([], 0, now), 'Nothing due this week. Suspicious.')
eq('only overdue', digestSubject([], 2, now), '2 things are overdue. We will not tell your prof.')
eq('overdue plus upcoming names the next one', digestSubject([tue, wed], 1, now), '1 overdue, and RELI 230 Midterm is tomorrow')
eq('one thing', digestSubject([wed], 0, now), 'Just one thing this week: COMM 305 Assignment 3, Wednesday')
eq('due today leads', digestSubject([today, tue], 0, now), 'Heads up: FINA 210 Quiz 4 is today 👀')
eq('agenda chip', JSON.stringify(agendaParts(wed.due, now)), JSON.stringify({ day: 'WED', date: '18', time: 'Due 11:59 p.m.', urgent: false }))
console.log(fail ? `\ndigest-copy: ${fail} FAILED` : '\ndigest-copy: all checks passed')
process.exit(fail ? 1 : 0)
