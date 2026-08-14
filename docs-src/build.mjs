/**
 * Generates the docs into dist/docs/<slug>/index.html, plus an index redirect,
 * a refreshed sitemap, and llms.txt.
 *
 * Runs as an npm `postbuild` hook, so `npm run build` — and therefore Vercel —
 * produces the docs without anyone remembering a second command.
 *
 * Writing into dist/ rather than public/ keeps generated HTML out of the source
 * tree: the content model is the source of truth, the pages are build output.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NAV, PAGES, flatten } from './content.mjs'
import { renderPage, plainText, esc } from './render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const SITE = 'https://concordiatracker.com'

if (!existsSync(DIST)) {
  console.error('[docs] dist/ not found — run `vite build` first.')
  process.exit(1)
}

const pages = flatten()
const year = new Date().getFullYear()

// Sidebar model with resolved titles.
const nav = NAV.map((g) => ({
  title: g.title,
  pages: g.pages.map((slug) => ({ slug, title: PAGES[slug].title })),
}))

// Search index — titles plus body text, inlined into each page.
const searchIndex = pages.map((p) => ({
  slug: p.slug,
  title: p.title,
  section: p.section,
  text: plainText(p).slice(0, 900),
}))

let written = 0
for (const [i, page] of pages.entries()) {
  const html = renderPage({
    page,
    nav,
    prev: pages[i - 1] ?? null,
    next: pages[i + 1] ?? null,
    searchIndex,
    year,
  })
  const dir = path.join(DIST, 'docs', page.slug)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html, 'utf8')
  written++
}

// /docs → the introduction. A meta refresh plus a real link, so a crawler that
// ignores the refresh still finds its way in.
await writeFile(
  path.join(DIST, 'docs', 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>ConcordiaTracker Docs</title>
<link rel="canonical" href="${SITE}/docs/introduction" />
<meta http-equiv="refresh" content="0; url=/docs/introduction" />
</head><body><p><a href="/docs/introduction">ConcordiaTracker documentation</a></p></body></html>`,
  'utf8',
)

/* ── sitemap ──────────────────────────────────────────────────────────────── */
// Rebuilt rather than appended, so removing a page removes its entry too.
const today = new Date().toISOString().slice(0, 10)
const staticUrls = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'weekly' },
  { loc: `${SITE}/concordia-gpa-calculator`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/concordia-syllabus-tracker`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/privacy`, priority: '0.3', changefreq: 'yearly' },
  { loc: `${SITE}/terms`, priority: '0.3', changefreq: 'yearly' },
]
const docUrls = pages.map((p) => ({
  loc: `${SITE}/docs/${p.slug}`,
  priority: p.slug === 'introduction' ? '0.9' : '0.7',
  changefreq: 'monthly',
}))
await writeFile(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...docUrls]
  .map(
    (u) =>
      `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`,
  'utf8',
)

/* ── llms.txt ─────────────────────────────────────────────────────────────── */
// An emerging convention: a plain-text map of the canonical docs for language
// models, so an assistant answering "how does ConcordiaTracker work" is reading
// the real pages rather than guessing from the marketing copy.
await writeFile(
  path.join(DIST, 'llms.txt'),
  `# ConcordiaTracker

> A web app for Concordia University students that turns course outlines into one
> dashboard of deadlines, grades, and GPA. Independent — not affiliated with
> Concordia University, and not connected to Moodle, eConcordia, or student records.

## Docs

${pages.map((p) => `- [${p.title}](${SITE}/docs/${p.slug}): ${p.description}`).join('\n')}

## Legal

- [Privacy Policy](${SITE}/privacy)
- [Terms of Service](${SITE}/terms)
`,
  'utf8',
)

/* ── sanity check: the content must actually be in the HTML ───────────────── */
// The entire reason these are static files is that crawlers which do not run
// JavaScript can read them. Verify that rather than assume it.
// Measured strictly between <main> and </main>: slicing to end-of-file would
// swallow the inlined search index and let a genuinely empty page pass.
function mainText(html) {
  const start = html.indexOf('<main>')
  const end = html.indexOf('</main>')
  if (start < 0 || end < 0) return ''
  return html
    .slice(start + 6, end)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

let thinnest = Infinity
for (const page of pages) {
  const html = await readFile(path.join(DIST, 'docs', page.slug, 'index.html'), 'utf8')
  const len = mainText(html).length
  if (len < 400) {
    console.error(`[docs] FAILED: /docs/${page.slug} rendered only ${len} chars of body text.`)
    process.exit(1)
  }
  thinnest = Math.min(thinnest, len)
}
const bodyText = { length: thinnest }

console.log(
  `[docs] ${written} pages → dist/docs/  ·  sitemap ${staticUrls.length + docUrls.length} urls  ·  llms.txt  ·  thinnest page ${bodyText.length} chars of body text`,
)
