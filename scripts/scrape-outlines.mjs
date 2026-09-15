/**
 * eConcordia outline scraper — local runner.
 *
 *   node scripts/scrape-outlines.mjs                  # current default semester
 *   node scripts/scrape-outlines.mjs --semester 123   # a specific one
 *   node scripts/scrape-outlines.mjs --all            # every semester
 *   node scripts/scrape-outlines.mjs --out .outlines  # where to put the results
 *
 * Does the half of the job that needs no keys: walk the catalogue, fetch each
 * outline PDF, extract its text, and write a coverage report. Structuring the
 * assessment table is the model's job and lives in /api/sync-outlines.
 *
 * This exists separately from the serverless endpoint because reviewing a
 * term's coverage by hand — which outlines are missing, which PDFs are scans —
 * is something you want to do on a laptop with the files in front of you, not
 * by reading a function log.
 *
 * Polite by construction: one catalogue fetch per semester, one GET per PDF,
 * ~1 req/sec.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const tmp = path.join(here, '.econcordia.bundle.mjs')
execSync(
  `npx esbuild --bundle "${path.join(root, 'api/_econcordia.ts')}" --format=esm --platform=neutral --outfile="${tmp}"`,
  { stdio: 'pipe', cwd: root },
)
const ec = await import(pathToFileURL(tmp).href)
fs.rmSync(tmp, { force: true })

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const outDir = path.join(root, flag('out', '.outlines'))
const semesters = args.includes('--all')
  ? ec.SEMESTERS.map((s) => s.id)
  : [flag('semester', '')]

fs.mkdirSync(path.join(outDir, 'pdf'), { recursive: true })
fs.mkdirSync(path.join(outDir, 'text'), { recursive: true })

const report = []

for (const sem of semesters) {
  const url = sem ? `${ec.CATALOG_URL}?semester=${encodeURIComponent(sem)}` : ec.CATALOG_URL
  process.stdout.write(`\ncatalogue ${sem || '(default)'} … `)
  const html = await ec.fetchText(url)
  const courses = ec.parseCatalog(html, sem)
  // The current term is the page default and is usually absent from its own
  // dropdown, so a missing label is expected, not an error.
  const listed = sem ? ec.semesterLabel(html, sem) : null
  const season = ec.SEMESTERS.find((s) => s.id === (sem || courses[0]?.semester))?.season ?? '?'
  const term = ec.termNameFrom(season, listed) ?? `${season} (year unknown)`
  console.log(`${courses.length} courses · ${term}`)

  for (const c of courses) {
    await ec.sleep(ec.POLITE_MS)
    const pdfUrl = ec.outlineUrl(c.slug)
    let row = { term, semester: c.semester, slug: c.slug, codes: c.codes, title: c.title, status: '' }
    try {
      const got = await ec.fetchOutline(pdfUrl)
      if (got.status !== 200 || !got.bytes) {
        row.status = String(got.status)
      } else {
        fs.writeFileSync(path.join(outDir, 'pdf', `${c.slug}.pdf`), got.bytes)
        const text = await ec.pdfText(got.bytes)
        fs.writeFileSync(path.join(outDir, 'text', `${c.slug}.txt`), text)
        row.status = text.trim().length > 200 ? 'ok' : 'no_text'
        row.chars = text.length
        row.hash = (await ec.sha256(got.bytes)).slice(0, 12)
        // A sanity check the outline is the term we think it is.
        const m = /\b(Fall|Winter|Summer)\s*\/?\s*(Winter)?\s*(20\d{2})\b/i.exec(text)
        row.termInPdf = m ? m[0].replace(/\s+/g, ' ') : null
      }
    } catch (e) {
      row.status = `error: ${e.message}`
    }
    report.push(row)
    console.log(`  ${row.status.padEnd(8)} ${c.codes.join('/').padEnd(18)} ${c.slug}`)
  }
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))

const by = (s) => report.filter((r) => r.status === s).length
console.log(
  `\n${report.length} courses · ok ${by('ok')} · no text ${by('no_text')} · 404 ${by('404')} · other ${
    report.length - by('ok') - by('no_text') - by('404')
  }`,
)
console.log(`report → ${path.relative(root, path.join(outDir, 'report.json'))}`)
