// Node-run checks for the registrar-deadline parser and matcher (`npm run test:deadlines`).
import { parseDate, parseDeadlinesPage, parseSpan, termCodes, writeDeadlines } from '../../api/_deadlines-parse.ts'
import { candidateTerms, deadlineList, deadlinesForCourse, sectionDeadlineEvents } from './section-deadlines.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}

// ── Parsing ──────────────────────────────────────────────────────────────────
check('long date', parseDate('Thursday, September 10, 2026') === '2026-09-10')
check('"Sept." with footnote stars', parseDate('Sept. 21, 2026**') === '2026-09-21')
check('no year → null', parseDate('March 10') === null)
check('span across the new year', JSON.stringify(parseSpan('Sept. 8–April 12, 2027')) === '{"from":"2026-09-08","to":"2027-04-12"}')

const nonStd = (heading, rows) =>
  `<h3>${heading}</h3><table><caption>Table showing non-standard dates</caption><tr><th>Subject</th><th>Catalog</th><th>Section</th><th>Start Date</th><th>End Date</th><th>Registration</th><th>DNE</th><th>DISC</th></tr>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
  `</table>`
const page =
  `<p>Registration start dates</p><table><tr><th>Registration start date</th><th>Credits</th></tr><tr><td>Tuesday, March 10</td><td>0-9</td></tr></table>` +
  `<h2>Summer term 2026</h2><p>The 2026 summer term is #2261.</p><h3>Standard dates</h3>` +
  `<table><tr><th>Term</th><th>Term Dates</th><th>Final Examination Dates</th><th>Registration</th><th>Dropping a Course*</th></tr>` +
  `<tr><th>Last day to add</th><th>DNE</th><th>DISC</th></tr>` +
  `<tr><td>May/June (Session 6 Wk 1) Sections begin with “4” and “A” and &quot;EC&quot;</td><td>May 11 – June 22, 2026</td><td>June 23 – June 30, 2026</td><td>May 19, 2026</td><td>May 19, 2026</td><td>June 10, 2026</td></tr>` +
  `<tr><td>May/August (Session 12W) Sections begin with “5” and “B” and &quot;EC&quot;</td><td>May 11 – August 12, 2026</td><td>August 13 – 18, 2026</td><td>May 19, 2026</td><td>May 19, 2026</td><td>July 22, 2026</td></tr></table>` +
  nonStd('Non-standard dates', [['ACCO', '470', 'GA', 'Monday, June 8, 2026', 'Friday, June 19, 2026', 'Monday, June 8, 2026', 'Monday, June 8, 2026', 'Wednesday, June 17, 2026']]) +
  `<h2>Fall and winter terms 2026-2027</h2><p>The 2026-27 term numbers are: Fall term #2262 Fall/winter term #2263 Winter term #2264</p>` +
  `<table><tr><th>Term</th><th>Term Dates</th><th>Final Examination Dates</th><th>Registration*</th><th>Dropping a Course*</th></tr>` +
  `<tr><td>Fall 2026 (Session 12W)</td><td>Sept. 8–Dec. 7, 2026</td><td>Dec. 9–22, 2026</td><td>Sept. 21, 2026**</td><td>Sept. 21, 2026</td><td>Nov. 16, 2026</td></tr>` +
  `<tr><td>Winter 2027 (Session 12W)</td><td>Jan. 11–April 12, 2027</td><td>April 15–May 2, 2027</td><td>Jan. 25, 2027**</td><td>Jan. 25, 2027</td><td>March 22, 2027</td></tr></table>` +
  nonStd('Non-standard fall term #2262', [
    ['ACCO', '652', 'GA', 'Tuesday, September 8, 2026', 'Thursday, October 1, 2026', 'Tuesday, September 15, 2026', 'Tuesday, September 15, 2026', 'Thursday, September 24, 2026'],
    ['COMM', '305', 'X', 'Tuesday, September 8, 2026', 'Friday, October 30, 2026', 'Tuesday, September 15, 2026', 'Tuesday, September 15, 2026', 'Friday, October 16, 2026'],
    ['', '', '', '', '', '', '', ''],
  ])

check('term numbers read from the page', JSON.stringify(termCodes(page)) === '{"summer":"2261","fall":"2262","fall/winter":"2263","winter":"2264"}', JSON.stringify(termCodes(page)))
const rows = parseDeadlinesPage(page)
const count = (t, k) => rows.filter((r) => r.term_code === t && r.kind === k).length
check('registration-start table ignored', !rows.some((r) => r.session.includes('March')))
check('summer: 2 standard + 1 section (heading has no term number)', count('2261', 'standard') === 2 && count('2261', 'section') === 1, JSON.stringify(rows.map((r) => [r.term_code, r.kind])))
check('fall: 1 standard + 2 sections, blank row dropped', count('2262', 'standard') === 1 && count('2262', 'section') === 2)
check('winter standard', count('2264', 'standard') === 1)
const fallStd = rows.find((r) => r.term_code === '2262' && r.kind === 'standard')
check('fall standard dates', fallStd?.dne === '2026-09-21' && fallStd?.disc === '2026-11-16' && fallStd?.start_date === '2026-09-08')
const summerStd = rows.find((r) => r.session.startsWith('May/June'))
check('summer session prefixes', JSON.stringify(summerStd?.section_prefixes) === '["4","A","EC"]', JSON.stringify(summerStd?.section_prefixes))
check('a page with no tables parses to nothing', parseDeadlinesPage('<p>Page moved</p>').length === 0)

// ── Writing: nothing on an empty parse ───────────────────────────────────────
let calls = 0
const fake = { from: () => ({ upsert: async () => (calls++, { error: null }), delete: () => ({ eq: () => ({ lt: async () => (calls++, { error: null }) }) }) }) }
const empty = await writeDeadlines(fake, [])
check('an empty parse writes and deletes nothing', empty.written === 0 && calls === 0)
const full = await writeDeadlines(fake, rows)
check('a real parse upserts once and prunes each term it saw', full.written === rows.length && calls === 1 + Object.keys(full.perTerm).length)

// ── Matching a student's course ──────────────────────────────────────────────
check('Fall looks at fall and the year-long term', JSON.stringify(candidateTerms('Fall 2026')) === '["2262","2263"]')
check('Summer looks at summer only', JSON.stringify(candidateTerms('Summer 2026')) === '["2261"]')

const fallSection = deadlinesForCourse({ code: 'COMM 305', section: 'X', term: 'Fall 2026' }, rows)
check('a non-standard section gets its own dates', fallSection?.kind === 'section' && fallSection.row.disc === '2026-10-16', JSON.stringify(fallSection))
const withTut = deadlinesForCourse({ code: 'COMM-305', section: 'X LEC · XA TUT', term: 'Fall 2026' }, rows)
check('a tutorial attached to the section does not confuse it', withTut?.kind === 'section')
const ordinary = deadlinesForCourse({ code: 'COMM 305', section: 'EC', term: 'Fall 2026' }, rows)
check('another section of the same course gets the standard dates', ordinary?.kind === 'standard' && ordinary.row.dne === '2026-09-21')
const unknown = deadlinesForCourse({ code: 'COMM 305', section: '', term: 'Fall 2026' }, rows)
check('NO SECTION + the course has non-standard sections → ask, never guess', unknown?.kind === 'needsSection', JSON.stringify(unknown))
const plain = deadlinesForCourse({ code: 'FINA 210', section: '', term: 'Fall 2026' }, rows)
check('no section and no non-standard sections → standard', plain?.kind === 'standard')
const summerB = deadlinesForCourse({ code: 'COMM 210', section: 'BB', term: 'Summer 2026' }, rows)
check('summer section "BB" → the 12-week session', summerB?.kind === 'standard' && summerB.row.session.startsWith('May/August'), JSON.stringify(summerB))
const summerEc = deadlinesForCourse({ code: 'COMM 210', section: 'EC', term: 'Summer 2026' }, rows)
check('summer "EC" is listed under every session → ask', summerEc?.kind === 'needsSection')
check('an unknown term → nothing', deadlinesForCourse({ code: 'COMM 305', section: 'X', term: 'Someday' }, rows) === null)

const list = deadlineList(fallSection.row)
check('registration folded into DNE when they are the same day', JSON.stringify(list.map((d) => d.key)) === '["dne","disc"]', JSON.stringify(list))

const events = sectionDeadlineEvents(
  [
    { id: 'a', code: 'COMM 305', section: 'X', term: 'Fall 2026' },
    { id: 'b', code: 'FINA 210', section: 'AA', term: 'Fall 2026' },
    { id: 'c', code: 'COMM 305', section: 'X', term: 'Fall 2026', archived: true },
  ],
  rows,
)
check('calendar: only the non-standard section, finished courses skipped', events.length === 2 && events.every((e) => e.id.startsWith('dl-a-')), JSON.stringify(events))
check('calendar: titled with the course', events[0]?.title.startsWith('COMM 305: ') && events[0]?.kind === 'deadline')

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nsection deadlines: all checks passed')
