// Node-run checks for lib/exam-period.ts (`npm run test:examperiod`).
import { examPeriodEvent, examPeriodHint as hintRaw, formatExamPeriod as fmtRaw, isFinalExam } from './exam-period.ts'

// The output carries non-breaking spaces and word joiners for layout; compare
// the text a reader sees.
const plain = (s) => (s == null ? s : s.replace(/\u00a0/g, ' ').replace(/\u2060/g, ''))
const formatExamPeriod = (...a) => plain(fmtRaw(...a))
const examPeriodHint = (...a) => plain(hintRaw(...a))

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}

check('kind final is a final', isFinalExam({ kind: 'final', title: 'Anything' }))
check('title "Final exam" is a final', isFinalExam({ kind: 'exam', title: 'Final Exam' }))
check('title "Examen final" is a final', isFinalExam({ kind: 'exam', title: 'Examen final' }))
check('"Final project" is not', !isFinalExam({ kind: 'project', title: 'Final project' }))
check('a midterm is not', !isFinalExam({ kind: 'midterm', title: 'Midterm exam' }))

check('Fall 2026 resolves', examPeriodEvent('Fall 2026')?.id === 'fa26-finals')
check('Winter 2027 resolves', examPeriodEvent('Winter 2027')?.id === 'wi27-finals')
check('FALL 2026 (any case) resolves', examPeriodEvent('FALL 2026')?.id === 'fa26-finals')
check('Automne 2026 resolves', examPeriodEvent('Automne 2026')?.id === 'fa26-finals')
check('Summer 2026 picks the full-term sitting', examPeriodEvent('Summer 2026')?.id === 'su26-finals')
check('a term not in the calendar is null', examPeriodEvent('Fall 2031') === null)
check('garbage is null', examPeriodEvent('whenever') === null && examPeriodEvent(null) === null)

const fall = examPeriodEvent('Fall 2026')
check('same-month range, EN', formatExamPeriod(fall, 'en') === 'Dec 9–22', formatExamPeriod(fall, 'en'))
const winter = examPeriodEvent('Winter 2027')
check('cross-month range, EN', formatExamPeriod(winter, 'en') === 'Apr 15 – May 2', formatExamPeriod(winter, 'en'))

const final = { kind: 'final', title: 'Final exam', due: null }
check('undated final gets the hint', examPeriodHint(final, 'Fall 2026') === 'Exam period Dec 9–22', String(examPeriodHint(final, 'Fall 2026')))
check('a DATED final gets nothing', examPeriodHint({ ...final, due: '2026-12-15T14:00:00Z' }, 'Fall 2026') === null)
check('an undated assignment gets nothing', examPeriodHint({ kind: 'assignment', title: 'A3', due: null }, 'Fall 2026') === null)
check('unknown term gets nothing', examPeriodHint(final, 'Fall 2031') === null)
check('no plain space left inside the range', !/Dec 9|9 –/.test(fmtRaw(examPeriodEvent('Fall 2026'))) )
check('French hint', (examPeriodHint(final, 'Fall 2026', 'fr') ?? '').startsWith('Période d’examens 9–22'), String(examPeriodHint(final, 'Fall 2026', 'fr')))

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nexam-period: all checks passed')
