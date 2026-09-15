/**
 * The pure half of the eConcordia scraper, against real captured markup.
 *
 *   node api/_econcordia.test.mjs
 *
 * These are the parts that fail SILENTLY when the site changes: a card regex
 * that stops matching yields "0 courses" and a clean exit, and a term derived
 * from our own clock instead of the page mis-files a whole semester. Both are
 * cheap to assert and expensive to notice in production.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const tmp = path.join(here, '.econcordia.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, '_econcordia.ts')}" --format=esm --platform=neutral --outfile="${tmp}"`,
  { stdio: 'pipe', cwd: root },
)
const { parseCatalog, splitCodes, semesterLabel, termNameFrom, outlineUrl, pdfText } = await import(
  pathToFileURL(tmp).href
)
fs.rmSync(tmp, { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// Captured from courses.aspx on 15 Sep 2026. Two ordinary cards and one
// cross-listed one, plus a thumbnail reference OUTSIDE the grid that must not
// be mistaken for a course.
const HTML = `
<img src="/home/src/assets/images/courses/not_a_course.jpg">
<ul id="main_content_CourseList_ulList">
<li><a href="CourseDetails.aspx?id=5940&semester=121" id="a0">
<img src="/home/src/assets/images/courses/program_planning.jpg" alt="">
<h3 class="ec-course-code ec-large-text">AHSC 260</h3>
<p>Program Planning Design and Evaluation</p>
</a></li>
<li><a href="CourseDetails.aspx?id=6031&semester=121" id="a1">
<img src="/home/src/assets/images/courses/youth_care.jpg" alt="">
<h3 class="ec-course-code ec-large-text">AHSC 322/AHSC 522</h3>
<p>Fundamentals of Youth Care</p>
</a></li>
<li><a href="CourseDetails.aspx?id=6100&semester=121" id="a2">
<img src="/home/src/assets/images/courses/managerial_accounting.jpg" alt="">
<h3 class="ec-course-code ec-large-text">COMM 305</h3>
<p>Managerial Accounting &amp; Decision Making</p>
</a></li>
</ul>
<select name="ctl00$main_content$CourseList$ddlSemester" id="main_content_CourseList_ddlSemester">
<option value="">Choose a semester</option>
<option value="118">Summer I (May 11, 2026 - June 22, 2026)</option>
<option value="122">Fall/Winter (September 8, 2026 - April 12, 2027)</option>
<option value="123">Winter (January 11, 2027 - April 12, 2027)</option>
</select>`

console.log('\nparseCatalog')
const cards = parseCatalog(HTML, '121')
check('finds every card', cards.length === 3, `got ${cards.length}`)
check('ignores a thumbnail outside the grid', !cards.some((c) => c.slug === 'not_a_course'))
check('slug comes from the thumbnail', cards[2].slug === 'managerial_accounting')
check('semester comes off the href', cards[0].semester === '121')
check('title entities are decoded', cards[2].title === 'Managerial Accounting & Decision Making')
check('a cross-listed card yields both codes', cards[1].codes.join() === 'AHSC 322,AHSC 522')

console.log('\nsplitCodes')
check('plain', splitCodes('COMM 305').join() === 'COMM 305')
check('cross-listed', splitCodes('FINA 200/GDBA 595').join() === 'FINA 200,GDBA 595')
check('normalises spacing', splitCodes('comp-248').join() === 'COMP 248')
check('a letter suffix survives', splitCodes('MATH 201A').join() === 'MATH 201A')
check('nothing course-shaped yields nothing', splitCodes('TBA').length === 0)

console.log('\nterm naming')
check('reads the label', semesterLabel(HTML, '123').startsWith('Winter (January 11, 2027'))
// The YEAR must come from the page, never from the clock: a scrape running in
// January must not file next Winter under the year that just ended.
check(
  'Winter 2027 comes from the page, not today',
  termNameFrom('Winter', semesterLabel(HTML, '123')) === 'Winter 2027',
)
check(
  'a Fall/Winter span is named for the year it starts in',
  termNameFrom('Fall/Winter', semesterLabel(HTML, '122')) === 'Fall/Winter 2026',
)
check('Summer', termNameFrom('Summer', semesterLabel(HTML, '118')) === 'Summer 2026')
// The CURRENT term is the page default and absent from its own dropdown.
check('an unlisted semester yields no term rather than a guess', semesterLabel(HTML, '121') === null)
check('and no term name', termNameFrom('Fall', null) === null)

console.log('\noutlineUrl')
check(
  'the slug, not the code, makes the URL',
  outlineUrl('managerial_accounting') ===
    'https://www.econcordia.com/outlines/managerial_accounting.pdf',
)

console.log('\npdfText')
// A real outline, if the local scrape cache is present. Skipped in CI.
const sample = path.join(root, '.outlines/pdf/managerial_accounting.pdf')
if (fs.existsSync(sample)) {
  const text = await pdfText(new Uint8Array(fs.readFileSync(sample)))
  // The tail of a PDF stream is padding, and awaiting the whole decompression
  // throws that error away along with every byte that already decoded. This is
  // the regression guard for that: the first run extracted nothing at all.
  check('extracts real text from a real outline', text.length > 20_000, `${text.length} chars`)
  check('finds the course', /COMM\s*305/.test(text))
  check('finds the term', /Fall\s*2026/.test(text))
} else {
  console.log('  skip  no local scrape cache (run scripts/scrape-outlines.mjs)')
}

console.log(failed === 0 ? '\neconcordia: all checks passed' : `\neconcordia: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
