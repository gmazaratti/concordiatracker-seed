/**
 * The syllabus parser's guard rails.
 *
 *   node api/_parse-guard.test.mjs
 *
 * A syllabus is a document someone else wrote, and the model's answer is
 * untrusted until narrowed. These pin the narrowing, the "is this text really
 * text" test that sent garbage to the model, and the file checks — each of them
 * is a rule where a silent regression would look fine and parse badly.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cleanParse,
  cleanDate,
  cleanWeight,
  cleanText,
  isPdf,
  pdfPageCount,
  wordRatio,
  textIsReadable,
  MAX_ITEMS,
} from './_parse-guard.ts'

let failures = 0
function check(label, ok, detail) {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${ok || detail === undefined ? '' : `  → ${JSON.stringify(detail)}`}`)
}

// ── Is the extracted text really text? ──────────────────────────────────────
const garbled = '!\n!\n1%23\n!\n9,44!&(&:\n;<44,=*.\n8H-.A!,0+\n-G8.?!\n!25!\n'.repeat(400)
const prose =
  'This course introduces students to Judaism and popular culture. The midterm is held in class during week five. '.repeat(40)
check('garbled font output scores near zero', wordRatio(garbled) < 0.05, wordRatio(garbled))
check('real prose scores high', wordRatio(prose) > 0.6, wordRatio(prose))
check('long garbage is NOT readable (the RELI 230 case)', textIsReadable(garbled, 1500) === false)
check('long prose is readable', textIsReadable(prose, 1500) === true)
check('short prose is not enough', textIsReadable('Midterm 30%', 1500) === false)

// ── Files ────────────────────────────────────────────────────────────────────
const enc = (s) => new TextEncoder().encode(s)
check('a PDF is recognised by its bytes', isPdf(enc('%PDF-1.7\n...')) === true)
check('a little junk before the header is tolerated', isPdf(enc('\n\n%PDF-1.4')) === true)
check('an HTML file labelled PDF is refused', isPdf(enc('<html><script>x</script>')) === false)
check('a DOCX (zip) is refused', isPdf(enc('PK\u0003\u0004word/document.xml')) === false)
check(
  'page objects counted, the /Pages tree is not',
  pdfPageCount(enc('<< /Type /Pages >> << /Type /Page >> << /Type/Page >> << /Type /Pages >>')) === 2,
)
const here = path.dirname(fileURLToPath(import.meta.url))
const sample = path.join(here, '..', '.outlines', 'pdf', 'managerial_accounting.pdf')
if (fs.existsSync(sample)) {
  const bytes = new Uint8Array(fs.readFileSync(sample))
  check('a real Concordia outline is a PDF', isPdf(bytes) === true)
  check('…and counts a sane number of pages', pdfPageCount(bytes) > 0 && pdfPageCount(bytes) < 40, pdfPageCount(bytes))
}

// ── Dates, weights, text ─────────────────────────────────────────────────────
check('a date passes', cleanDate('2026-10-06') === '2026-10-06')
check('a datetime passes', cleanDate('2026-11-17T23:59:00') === '2026-11-17T23:59:00')
check('Feb 30 is not a date', cleanDate('2026-02-30') === null)
check('free text is not a date', cleanDate('week 5') === null)
check('year 3026 is refused', cleanDate('3026-10-06') === null)
check('a number is not a date', cleanDate(20261006) === null)
check('weight 25 passes', cleanWeight(25) === 25)
check('weight 150 is dropped, not clamped', cleanWeight(150) === null)
check('weight -5 is dropped', cleanWeight(-5) === null)
check('weight "30" string is read', cleanWeight('30') === 30)
check('weight NaN is dropped', cleanWeight('abc') === null)
check('control chars and bidi overrides removed', cleanText('Mid\u0000term‮ exam', 50) === 'Mid term exam')
check('text capped', cleanText('x'.repeat(500), 150).length === 150)
check('non-string text is empty', cleanText({ evil: true }, 50) === '')

// ── The whole answer ─────────────────────────────────────────────────────────
const hostile = {
  course: {
    code: 'RELI 230',
    title: '<img src=x onerror=alert(1)>',
    instructorEmail: 'not an email <script>',
    taEmail: 'ta@concordia.ca',
  },
  assessments: [
    { title: 'Midterm', kind: 'midterm', due: '2026-10-06', weight: 25, description: '', noDateNeeded: false },
    { title: 'Attendance', kind: 'quiz', due: '2026-09-01', weight: 10, description: '', noDateNeeded: true },
    { title: 'Creative project', kind: 'essay', due: 'week 10', weight: 30, description: '', noDateNeeded: false },
    { title: '', kind: 'quiz', due: null, weight: 5 },
    null,
    'just a string',
    { title: 'Bonus', kind: 'final', due: '2026-13-45', weight: 900, description: 'x'.repeat(2000) },
  ],
}
const out = cleanParse(hostile)
check('HTML in a title is kept as TEXT (React renders it escaped), not dropped', out.course.title === '<img src=x onerror=alert(1)>')
check('a malformed email is removed', out.course.instructorEmail === '')
check('a real email survives', out.course.taEmail === 'ta@concordia.ca')
check('untitled / non-object items are dropped', out.assessments.length === 4, out.assessments.map((a) => a.title))
check('an unknown kind becomes assignment', out.assessments[2].kind === 'assignment')
check('"no date needed" forces due to null', out.assessments[1].due === null && out.assessments[1].noDateNeeded === true)
check('a relative date the model failed to resolve is null, not text', out.assessments[2].due === null)
check('an impossible date is null', out.assessments[3].due === null)
check('an impossible weight is null', out.assessments[3].weight === null)
check('descriptions are capped', out.assessments[3].description.length === 400)
check('a sane total raises no warning', out.warnings.length === 0, out.warnings)

const recurring = cleanParse({
  assessments: [
    { title: 'Weekly participation activity on Moodle', kind: 'assignment', weight: 15, noDateNeeded: true },
    { title: 'Reading responses', kind: 'reading', weight: 10, noDateNeeded: true },
    { title: 'Attendance', kind: 'quiz', weight: 10, noDateNeeded: true },
    { title: 'In-class participation', kind: 'quiz', weight: 5, noDateNeeded: true },
  ],
})
check('weekly Moodle posts stay "date not set", not "no date needed"', recurring.assessments[0].noDateNeeded === false)
check('reading responses stay "date not set"', recurring.assessments[1].noDateNeeded === false)
check('attendance is still "no date needed"', recurring.assessments[2].noDateNeeded === true)
check('in-class participation is still "no date needed"', recurring.assessments[3].noDateNeeded === true)

const heavy = cleanParse({ assessments: Array.from({ length: 5 }, (_, i) => ({ title: `Q${i}`, kind: 'quiz', weight: 40 })) })
check('weights adding to 200% raise a warning', heavy.warnings.some((w) => w.includes('200%')), heavy.warnings)
const flood = cleanParse({ assessments: Array.from({ length: 500 }, (_, i) => ({ title: `Item ${i}`, kind: 'quiz' })) })
check(`at most ${MAX_ITEMS} assessments are kept`, flood.assessments.length === MAX_ITEMS)
check('…and the student is told', flood.warnings.some((w) => w.includes(String(MAX_ITEMS))))
check('a missing course is an empty course, not a crash', cleanParse({}).course.code === '')

console.log(failures === 0 ? '\nparse guard: all checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
