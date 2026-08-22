/**
 * Everything that makes the site legible to something that does not run
 * JavaScript.
 *
 * The app is a single-page app: `dist/index.html` ships an empty `#root` and
 * ~76 characters of text. Googlebot renders JS and eventually sees the page;
 * GPTBot, PerplexityBot and ClaudeBot largely do not, so to them the homepage
 * has no content at all. Same problem the docs site was built to solve, applied
 * to the rest of the public surface.
 *
 * What this emits, all into dist/ so nothing generated lands in the source tree:
 *
 *   index.html      the real hero copy injected into #root, plus JSON-LD.
 *                   React clears the container on mount, so this is what a
 *                   crawler reads and never what a user interacts with.
 *   index.md        the same copy as markdown, for Accept: text/markdown.
 *   about|contact|developers/   standalone trust and developer pages.
 *   docs/<slug>/index.md        every docs page as markdown.
 *   prerendered/<doc>.html      index.html with the legal text already inside
 *                   #root, so /privacy and /terms read as real documents.
 *
 * The homepage copy is duplicated from src/i18n/en.ts rather than imported,
 * because this runs during `postbuild` where the app's module graph and its
 * `@/` alias are not available. `scripts/verify-agent-readiness.mjs` asserts
 * the two have not drifted.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { esc } from './render.mjs'

export const SITE = 'https://concordiatracker.com'
export const CONTACT_EMAIL = 'concordiatracker@gmail.com'

/* ── the shared identity, used by JSON-LD on every generated page ─────────── */

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'ConcordiaTracker',
  url: SITE,
  logo: `${SITE}/icon-512.png`,
  email: CONTACT_EMAIL,
  description:
    'ConcordiaTracker is an independent web app for Concordia University students that turns ' +
    'course outlines into one dashboard of deadlines, grades, and GPA projections.',
  // City-level only. A street address is a decision for the operator, not
  // something to invent for a schema validator.
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Montreal',
    addressRegion: 'QC',
    addressCountry: 'CA',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: CONTACT_EMAIL,
      url: `${SITE}/contact`,
      availableLanguage: ['en', 'fr'],
      areaServed: 'CA',
    },
    {
      '@type': 'ContactPoint',
      contactType: 'technical support',
      email: CONTACT_EMAIL,
      url: `${SITE}/developers`,
      availableLanguage: ['en'],
    },
  ],
}

/* ── homepage copy ────────────────────────────────────────────────────────── */
// Mirrors src/i18n/en.ts. Kept in sync by the verification script.

export const HOME = {
  h1: 'Stop guessing what’s due.',
  body:
    'ConcordiaTracker turns your syllabi into a live plan: every deadline, grade calculation, ' +
    'and GPA projection for all your classes, in one calm dashboard.',
  intro:
    'ConcordiaTracker is a web app for Concordia University students. You add your courses once — ' +
    'by importing an outline another student or a professor has already shared, by uploading a ' +
    'syllabus PDF, or by typing them in — and it tracks what is due, what each piece of work is ' +
    'worth, and where your grade actually stands. It is independent software: not affiliated with ' +
    'Concordia University, and not connected to Moodle, eConcordia, or your student record.',
  features: [
    {
      title: 'Every deadline in one place',
      desc:
        'Deadlines from every course land on one Today view, sorted by what is due next, instead ' +
        'of being scattered across Moodle, email, and PDFs.',
    },
    {
      title: 'Grades and GPA on Concordia’s scale',
      desc:
        'Grade calculations run on Concordia’s 4.30 scale. See the mark you need on what is left ' +
        'to hit a target, and run what-if scenarios before you commit.',
    },
    {
      title: 'Dates you can trust',
      desc:
        'Every date carries its provenance — taken from an official outline, confirmed by other ' +
        'students, or unverified — so you know which ones to double-check.',
    },
    {
      title: 'Plan next term before you register',
      desc:
        'Search the full Concordia course calendar, check prerequisites, build a timetable from ' +
        'real sections, and get told when a full section opens a seat.',
    },
  ],
  faq: [
    {
      q: 'How do I keep track of all my Concordia deadlines?',
      a:
        'Add your courses — search a shared outline, upload a syllabus, or enter them by hand — and ' +
        'ConcordiaTracker puts every deadline on one Today view, sorted by what is due next, across ' +
        'all your classes.',
    },
    {
      q: 'Is there a GPA calculator for Concordia’s grading scale?',
      a:
        'Yes. ConcordiaTracker calculates your GPA on Concordia’s 4.30 scale, shows the grade you ' +
        'need on what is left to hit a target, and lets you run what-if scenarios.',
    },
    {
      q: 'Does it work for any Concordia course?',
      a:
        'Yes, any course or faculty. Import a classmate’s or a teacher’s outline, upload your own ' +
        'syllabus, or build a course by hand.',
    },
    {
      q: 'Is ConcordiaTracker free?',
      a:
        'The core — deadline tracking, the grade-needed calculator, and your full course dashboard — ' +
        'is free. GPA prediction and the other Semester pass features are paid.',
    },
    {
      q: 'Is ConcordiaTracker affiliated with Concordia University?',
      a:
        'No. It is an independent project, built by students. It does not connect to Moodle, ' +
        'eConcordia, or your official student record.',
    },
  ],
  links: [
    ['Open the app', '/app'],
    ['Documentation', '/docs/introduction'],
    ['Developer resources and API', '/developers'],
    ['About', '/about'],
    ['Contact', '/contact'],
    ['Privacy policy', '/privacy'],
    ['Terms of service', '/terms'],
  ],
}

/* ── standalone page shell ────────────────────────────────────────────────── */
// Deliberately self-contained: inline tokens matching the app's dark theme, no
// build-asset dependency, so these pages render correctly even if the hashed
// CSS bundle name changes underneath them.

const SHELL_CSS = `
:root{color-scheme:dark;--bg:#0f0f16;--surface:#191926;--surface2:#22222f;--fg:#f2f1f6;--muted:#b9b7c4;--subtle:#8b8898;--accent:#8fb39a;--border:#2a2a3a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:46rem;margin:0 auto;padding:28px 22px 80px}
header.top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-bottom:18px;border-bottom:1px solid var(--border)}
.brand{font-weight:600;font-size:16px;color:var(--fg);text-decoration:none}
.brand span{color:var(--muted)}
header.top nav{margin-left:auto;display:flex;gap:16px;flex-wrap:wrap}
header.top nav a{color:var(--muted);text-decoration:none;font-size:14px}
header.top nav a:hover{color:var(--fg)}
h1{font-size:32px;line-height:1.15;margin:30px 0 14px;font-weight:600;letter-spacing:-0.01em}
h2{font-size:19px;margin:34px 0 10px;font-weight:600}
h3{font-size:16px;margin:22px 0 6px;font-weight:600}
p,li{color:var(--muted)}
p{margin:0 0 14px;max-width:64ch}
ul,ol{max-width:64ch;padding-left:20px}
li{margin:0 0 7px}
a{color:var(--accent)}
code{background:var(--surface2);padding:2px 5px;border-radius:5px;font-size:13.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--fg)}
pre{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px 16px;overflow-x:auto;max-width:100%}
pre code{background:none;padding:0;font-size:13px;line-height:1.55}
.lede{font-size:17px;color:var(--fg)}
.note{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px 16px;margin:0 0 16px;max-width:64ch}
.note p:last-child{margin:0}
table{border-collapse:collapse;width:100%;max-width:64ch;margin:0 0 18px;font-size:14.5px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:top}
th{color:var(--fg);font-weight:600}
td{color:var(--muted)}
footer.foot{margin-top:44px;padding-top:18px;border-top:1px solid var(--border);color:var(--subtle);font-size:13px;display:flex;gap:16px;flex-wrap:wrap}
footer.foot a{color:var(--subtle)}
@media (max-width:640px){.wrap{padding:20px 16px 60px}h1{font-size:26px}header.top nav{margin-left:0;width:100%}}
`

function shell({ title, description, slug, bodyHtml, jsonLd }) {
  const url = `${SITE}/${slug}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · ConcordiaTracker</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ConcordiaTracker" />
<meta property="og:title" content="${esc(title)} · ConcordiaTracker" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate" type="text/markdown" href="${url}.md" />
<style>${SHELL_CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="brand" href="/">Concordia<span>Tracker</span></a>
  <nav>
    <a href="/docs/introduction">Docs</a>
    <a href="/developers">Developers</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
    <a href="/app">Open app</a>
  </nav>
</header>
<main>
${bodyHtml}
</main>
<footer class="foot">
  <span>&copy; ${new Date().getFullYear()} ConcordiaTracker</span>
  <span>Not affiliated with Concordia University.</span>
  <a href="/privacy">Privacy</a>
  <a href="/terms">Terms</a>
  <a href="/llms.txt">llms.txt</a>
  <a href="/openapi.json">OpenAPI</a>
</footer>
</div>
</body>
</html>
`
}

/* ── trust and developer pages ────────────────────────────────────────────── */

const ABOUT_MD = `# About ConcordiaTracker

ConcordiaTracker is an independent web app for students at Concordia University in Montreal,
Quebec. It takes the thing every course already gives you — a course outline listing what is due,
when, and how much it is worth — and turns it into a single working dashboard of deadlines, grades,
and GPA projections across all of your classes.

## Why it exists

A Concordia student typically carries four or five courses at once. Each one publishes its own
outline, on its own schedule, in its own format, to its own place: Moodle for one, a PDF emailed
for another, a page on eConcordia for a third. Nothing joins them up. The result is that students
know each course individually and know their term not at all — which is how three midterms in one
week gets discovered in that week rather than in September.

ConcordiaTracker joins them up. You add a course once, by importing an outline another student or
professor has already shared, by uploading a syllabus, or by typing it in. From there every
deadline appears on one screen sorted by what is next, every grade you enter updates your standing
in that course and your GPA on Concordia's 4.30 scale, and the planner shows what next term would
look like before you register for it.

## What it is not

It is not affiliated with, endorsed by, or operated by Concordia University. It does not connect to
Moodle, eConcordia, or your official student record, and it cannot register you for a course, pay
your tuition, or change your transcript. Where the app shows information taken from Concordia's
published course calendar or academic calendar, it says so and links to the source, because the
university is the authority and this app is not.

## How dates are trusted

Every date in the app carries its provenance: taken from an official outline, confirmed by a number
of other students in the same section, or unverified because one person entered it. That marking is
visible wherever a date is shown. A tool that quietly presents a guess as a fact is worse than no
tool, so the app is built to say which is which.

## Contact

Support and general enquiries: ${CONTACT_EMAIL}. See [Contact](${SITE}/contact) for the ways to
reach us and what to expect.
`

const CONTACT_MD = `# Contact ConcordiaTracker

ConcordiaTracker is an independent project run from Montreal, Quebec, Canada. There is no phone
line and no call centre; everything below reaches a person who works on the app.

## Support

Email **${CONTACT_EMAIL}** for anything: a bug, a billing question, an account problem, a feature
request, or a correction to information the app shows about a course.

You can also open a support ticket in the app, or without an account at
[${SITE}/docs/support](${SITE}/docs/support). A ticket gives you a case number and a private link
so you can follow the conversation and reply without signing in. Tickets are usually answered
within a couple of days.

To check a ticket you already have, use [${SITE}/docs/support-status](${SITE}/docs/support-status)
with your case number and access key.

## Reporting something wrong in the app

If a course outline, a date, a prerequisite, a tuition figure, or a degree requirement is wrong,
say which page you saw it on and what it should be. Content taken from Concordia's published
calendars is transcribed by hand and stamped with the year it came from, so corrections are quick
to make and worth making.

## Privacy, data, and Law 25

For access to your data, correction, deletion, or any question about how information is handled
under Quebec's Law 25, email ${CONTACT_EMAIL} with "Privacy" in the subject. The full policy is at
[${SITE}/privacy](${SITE}/privacy).

## Developers and agents

API documentation, the OpenAPI specification, and guidance for automated clients are at
[${SITE}/developers](${SITE}/developers).

## Teachers and student organizations

Professors publishing a course outline and student groups listing events both have their own
portals. Start at [${SITE}/docs/teacher-portal](${SITE}/docs/teacher-portal) or
[${SITE}/docs/organizer-portal](${SITE}/docs/organizer-portal), or email ${CONTACT_EMAIL} to
request access.
`

const DEVELOPERS_MD = `# ConcordiaTracker developer resources

The ConcordiaTracker HTTP API, its machine-readable description, and the conventions an automated
client or AI agent should follow.

## Quick reference

| Resource | URL |
| --- | --- |
| OpenAPI 3.1 specification | [${SITE}/openapi.json](${SITE}/openapi.json) |
| Machine-readable site index | [${SITE}/llms.txt](${SITE}/llms.txt) |
| Sitemap | [${SITE}/sitemap.xml](${SITE}/sitemap.xml) |
| Documentation | [${SITE}/docs/introduction](${SITE}/docs/introduction) |
| API reference | [${SITE}/docs/api](${SITE}/docs/api) |
| Support | ${CONTACT_EMAIL} |

## Base URL

All endpoints live under \`${SITE}/api/\`. Every response, including every error, is JSON.

## The open endpoint

\`GET /api/sections\` needs no authentication and answers the question most worth asking a
Concordia course tool: when does a course meet, where, and is there a seat.

\`\`\`bash
curl -s "${SITE}/api/sections?subject=COMP&catalog=248"
\`\`\`

It returns every published section of that course for the terms Concordia currently lists, newest
term first, with meeting times, building and room, instruction mode, and live enrolment and
waitlist counts. \`classNumber\` is the value Concordia's Student Centre asks for when enrolling.

## Authentication

Everything else requires a signed-in user. Send a Supabase access token:

\`\`\`
Authorization: Bearer <supabase-access-token>
\`\`\`

Two endpoints are internal scheduled jobs authenticated with a deployment secret rather than a user
token. They are listed in the specification for completeness and are not callable by clients.

## Errors

Every failure returns the same JSON shape, so one parser handles all of them:

\`\`\`json
{
  "error": "Give a subject and catalog number, e.g. COMP 248.",
  "code": "bad_request",
  "message": "Give a subject and catalog number, e.g. COMP 248.",
  "hint": "Check the request parameters against the OpenAPI schema at /openapi.json.",
  "status": 400,
  "docs": "${SITE}/docs/api"
}
\`\`\`

\`code\` is stable and safe to branch on. The values are \`bad_request\`, \`unauthorized\`,
\`forbidden\`, \`not_found\`, \`method_not_allowed\`, \`conflict\`, \`rate_limited\`,
\`not_configured\`, \`upstream_error\`, and \`internal_error\`. An unknown path under \`/api/\`
returns a JSON \`not_found\`, never an HTML error page.

## Content negotiation

The homepage, every documentation page, and these developer pages are available as markdown. Ask
for it and you will get it, with \`Vary: Accept\` set so a cache cannot hand you the wrong variant:

\`\`\`bash
curl -s -H "Accept: text/markdown" ${SITE}/docs/introduction
\`\`\`

## Function calling

The specification at [${SITE}/openapi.json](${SITE}/openapi.json) is OpenAPI 3.1. Every operation
has a unique \`operationId\`, a description written for a caller rather than a maintainer, typed
parameters, and a response schema, so it converts directly into tool definitions for an LLM
function-calling runtime without hand-editing.

## Rate limits and etiquette

There is no published quota on \`GET /api/sections\`, but it proxies Concordia's own directory:
cache results, do not poll in a tight loop, and identify your client with a \`User-Agent\`. Ticket
creation is rate limited per IP address. If you are building something that needs more than casual
use, email ${CONTACT_EMAIL} first.

## Status

The API backs a live product and its shape is stable, but it is versioned by the specification
rather than by URL. Breaking changes will be announced in the documentation before they ship.
`

/* ── markdown → minimal HTML ──────────────────────────────────────────────── */
// A deliberately small converter: this renders copy written in this file, not
// arbitrary user input, so it handles exactly the constructs used above.

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function markdownToHtml(md) {
  const out = []
  const lines = md.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
      continue
    }
    if (line.startsWith('### ')) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`)
      i++
      continue
    }
    if (line.startsWith('## ')) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`)
      i++
      continue
    }
    if (line.startsWith('# ')) {
      out.push(`<h1>${inline(line.slice(2))}</h1>`)
      i++
      continue
    }
    if (line.startsWith('| ')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++])
      const cells = (r) =>
        r
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
      const head = cells(rows[0])
      const body = rows.slice(2).map(cells)
      out.push(
        `<table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>` +
          `<tbody>${body
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`,
      )
      continue
    }
    if (line.startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2))
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`)
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    // Always consume the first line, then keep taking lines that cannot start
    // another block. Without the unconditional first take, a paragraph opening
    // with a backtick or a dash matches the guard, consumes nothing, and spins
    // forever — which is exactly how this first ran out of heap.
    const para = [lines[i++]]
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3} |[-|] |```)/.test(lines[i])) {
      para.push(lines[i++])
    }
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  return out.join('\n')
}

/* ── docs pages as markdown ───────────────────────────────────────────────── */

export function docPageToMarkdown(page) {
  const parts = [`# ${page.title}`, '', page.description, '']
  for (const b of page.blocks) {
    if (b.h2) parts.push('', `## ${b.h2}`, '')
    if (b.h3) parts.push('', `### ${b.h3}`, '')
    if (b.p) parts.push(b.p, '')
    if (b.ul) parts.push(...b.ul.map((x) => `- ${x}`), '')
    if (b.ol) parts.push(...b.ol.map((x, n) => `${n + 1}. ${x}`), '')
    if (b.note) parts.push(`> ${b.note}`, '')
    if (b.cards) parts.push(...b.cards.map((c) => `- [${c.title}](${c.href}): ${c.desc}`), '')
  }
  parts.push('', '---', '', `Source: ${SITE}/docs/${page.slug}`)
  return parts.join('\n').replace(/\n{3,}/g, '\n\n')
}

/* ── homepage ─────────────────────────────────────────────────────────────── */

function homeMarkdown() {
  const lines = [
    `# ${HOME.h1}`,
    '',
    HOME.body,
    '',
    HOME.intro,
    '',
    '## What it does',
    '',
    ...HOME.features.map((f) => `- **${f.title}** — ${f.desc}`),
    '',
    '## Questions Concordia students ask',
    '',
  ]
  for (const item of HOME.faq) lines.push(`### ${item.q}`, '', item.a, '')
  lines.push('## Where to go next', '')
  for (const [label, href] of HOME.links) lines.push(`- [${label}](${SITE}${href})`)
  lines.push(
    '',
    '---',
    '',
    'ConcordiaTracker is independent and not affiliated with Concordia University.',
    `Machine-readable index: ${SITE}/llms.txt · API: ${SITE}/openapi.json`,
  )
  return lines.join('\n')
}

function homeFallbackHtml() {
  // Styled to match the app's dark canvas: this is visible for the moment
  // before React mounts, so it should read as the page arriving rather than as
  // a flash of something else.
  return `<div id="ct-prerender" style="max-width:46rem;margin:0 auto;padding:40px 22px;font:16px/1.65 Inter,system-ui,sans-serif;color:#b9b7c4;background:#0f0f16">
<h1 style="font-size:34px;line-height:1.12;margin:0 0 14px;color:#f2f1f6;font-weight:600;letter-spacing:-0.01em">${esc(HOME.h1)}</h1>
<p style="font-size:17px;color:#f2f1f6;margin:0 0 16px">${esc(HOME.body)}</p>
<p style="margin:0 0 20px">${esc(HOME.intro)}</p>
<h2 style="font-size:19px;color:#f2f1f6;margin:26px 0 10px;font-weight:600">What it does</h2>
<ul style="padding-left:20px;margin:0 0 20px">
${HOME.features.map((f) => `<li style="margin:0 0 8px"><strong style="color:#f2f1f6">${esc(f.title)}</strong> — ${esc(f.desc)}</li>`).join('\n')}
</ul>
<h2 style="font-size:19px;color:#f2f1f6;margin:26px 0 10px;font-weight:600">Questions Concordia students ask</h2>
${HOME.faq.map((f) => `<h3 style="font-size:15.5px;color:#f2f1f6;margin:18px 0 6px;font-weight:600">${esc(f.q)}</h3><p style="margin:0 0 12px">${esc(f.a)}</p>`).join('\n')}
<h2 style="font-size:19px;color:#f2f1f6;margin:26px 0 10px;font-weight:600">Where to go next</h2>
<ul style="padding-left:20px;margin:0 0 20px">
${HOME.links.map(([label, href]) => `<li style="margin:0 0 6px"><a href="${href}" style="color:#8fb39a">${esc(label)}</a></li>`).join('\n')}
</ul>
<p style="font-size:13px;color:#8b8898;margin:24px 0 0">ConcordiaTracker is independent and not affiliated with Concordia University.</p>
</div>`
}

function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: SITE,
        name: 'ConcordiaTracker',
        description: HOME.body,
        inLanguage: ['en-CA', 'fr-CA'],
        publisher: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE}/#app`,
        name: 'ConcordiaTracker',
        url: SITE,
        applicationCategory: 'EducationalApplication',
        applicationSubCategory: 'Academic planner',
        operatingSystem: 'Web browser',
        browserRequirements: 'Requires JavaScript. Works in any modern browser.',
        description: HOME.intro,
        featureList: HOME.features.map((f) => f.title),
        inLanguage: ['en-CA', 'fr-CA'],
        author: { '@id': `${SITE}/#organization` },
        publisher: { '@id': `${SITE}/#organization` },
        softwareHelp: `${SITE}/docs/introduction`,
        audience: {
          '@type': 'EducationalAudience',
          educationalRole: 'student',
          audienceType: 'Concordia University students',
        },
        offers: [
          {
            '@type': 'Offer',
            name: 'Free',
            price: '0',
            priceCurrency: 'CAD',
            description:
              'Deadline tracking, the grade-needed calculator, and the full course dashboard.',
            availability: 'https://schema.org/InStock',
            url: `${SITE}/#pricing`,
          },
          {
            '@type': 'Offer',
            name: 'Semester pass',
            price: '15',
            priceCurrency: 'CAD',
            description: 'Everything free, plus GPA prediction and the rest of the paid features.',
            availability: 'https://schema.org/InStock',
            url: `${SITE}/#pricing`,
          },
          {
            '@type': 'Offer',
            name: 'Monthly',
            price: '5',
            priceCurrency: 'CAD',
            description: 'The same paid features, billed monthly.',
            availability: 'https://schema.org/InStock',
            url: `${SITE}/#pricing`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE}/#faq`,
        mainEntity: HOME.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}

/* ── legal prerender ──────────────────────────────────────────────────────── */

function legalBlocksToHtml(doc) {
  const parts = [
    `<h1 style="font-size:30px;margin:0 0 6px;color:#f2f1f6;font-weight:600">${esc(doc.title)}</h1>`,
    `<p style="color:#8b8898;margin:0 0 20px">Last updated ${esc(doc.lastUpdated)}</p>`,
  ]
  if (doc.intro) parts.push(`<p style="margin:0 0 18px">${esc(doc.intro)}</p>`)
  for (const section of doc.sections) {
    parts.push(
      `<h2 style="font-size:18px;color:#f2f1f6;margin:26px 0 8px;font-weight:600">${section.n}. ${esc(section.title)}</h2>`,
    )
    for (const b of section.blocks) {
      if (b.kind === 'p') parts.push(`<p style="margin:0 0 12px">${esc(b.text)}</p>`)
      else if (b.kind === 'highlight' || b.kind === 'callout')
        parts.push(
          `<p style="margin:0 0 12px">${b.title ? `<strong style="color:#f2f1f6">${esc(b.title)}</strong> ` : ''}${esc(b.text)}</p>`,
        )
      else if (b.kind === 'list')
        parts.push(
          `<ul style="padding-left:20px;margin:0 0 12px">${b.items
            .map((it) =>
              typeof it === 'string'
                ? `<li style="margin:0 0 6px">${esc(it)}</li>`
                : `<li style="margin:0 0 6px"><strong style="color:#f2f1f6">${esc(it.label)}</strong> ${esc(it.text)}</li>`,
            )
            .join('')}</ul>`,
        )
      else if (b.kind === 'links')
        parts.push(
          `<ul style="padding-left:20px;margin:0 0 12px">${b.items
            .map((l) => `<li style="margin:0 0 6px"><a href="${esc(l.href)}" style="color:#8fb39a">${esc(l.label)}</a></li>`)
            .join('')}</ul>`,
        )
    }
  }
  return `<div id="ct-prerender" style="max-width:46rem;margin:0 auto;padding:40px 22px;font:16px/1.65 Inter,system-ui,sans-serif;color:#b9b7c4;background:#0f0f16">${parts.join('\n')}</div>`
}

/** Reads the app's own legal source. Null when the runtime cannot strip types. */
async function loadLegalDocs() {
  try {
    const mod = await import('../src/features/legal/legal-content.ts')
    return mod.LEGAL_DOCS ?? null
  } catch {
    return null
  }
}

/* -- #root surgery -------------------------------------------------------- */

/**
 * Find the span of `<div id="root">...</div>` by counting nested divs.
 *
 * Anchoring on the `<script type="module">` tag does not work: Vite hoists that
 * into <head> in the built output, so a regex expecting it after the root div
 * matches nothing at all -- which is how four legal pages first got written
 * carrying the homepage's text. Counting is unambiguous, and because it finds
 * the real end tag every time, re-running the build over an already-injected
 * dist/ replaces cleanly instead of nesting.
 */
export function rootSpan(html) {
  const open = html.indexOf('<div id="root"')
  if (open < 0) return null
  const contentStart = html.indexOf('>', open) + 1
  let depth = 1
  let i = contentStart
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)
    if (nextClose < 0) return null
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 4
    } else {
      depth--
      if (depth === 0) return { contentStart, contentEnd: nextClose }
      i = nextClose + 6
    }
  }
  return null
}

/** Replace whatever is inside #root. Idempotent. */
export function setRootContent(html, inner) {
  const span = rootSpan(html)
  if (!span) throw new Error('could not locate <div id="root"> in the built index.html')
  return html.slice(0, span.contentStart) + inner + html.slice(span.contentEnd)
}

/* ── entry point ──────────────────────────────────────────────────────────── */

export async function buildAgentPages({ dist, pages }) {
  const written = []

  /* 1. Docs pages as markdown, beside the HTML they mirror. */
  for (const page of pages) {
    const file = path.join(dist, 'docs', page.slug, 'index.md')
    await writeFile(file, docPageToMarkdown(page), 'utf8')
    written.push(`docs/${page.slug}/index.md`)
  }

  /* 2. Trust and developer pages. */
  const standalone = [
    {
      slug: 'about',
      title: 'About',
      description:
        'ConcordiaTracker is an independent deadline, grade, and GPA tracker for Concordia ' +
        'University students. What it does, why it exists, and what it is not.',
      md: ABOUT_MD,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          ORGANIZATION,
          {
            '@type': 'AboutPage',
            '@id': `${SITE}/about#page`,
            url: `${SITE}/about`,
            name: 'About ConcordiaTracker',
            about: { '@id': `${SITE}/#organization` },
          },
        ],
      },
    },
    {
      slug: 'contact',
      title: 'Contact',
      description:
        'How to reach ConcordiaTracker: support email, in-app tickets, privacy and Law 25 ' +
        'requests, and access for teachers and student organizations.',
      md: CONTACT_MD,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          ORGANIZATION,
          {
            '@type': 'ContactPage',
            '@id': `${SITE}/contact#page`,
            url: `${SITE}/contact`,
            name: 'Contact ConcordiaTracker',
            about: { '@id': `${SITE}/#organization` },
          },
        ],
      },
    },
    {
      slug: 'developers',
      title: 'Developers',
      description:
        'The ConcordiaTracker API: OpenAPI 3.1 specification, authentication, the open course ' +
        'section endpoint, JSON error codes, markdown content negotiation, and function-calling ' +
        'compatibility.',
      md: DEVELOPERS_MD,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          ORGANIZATION,
          {
            '@type': 'TechArticle',
            '@id': `${SITE}/developers#page`,
            url: `${SITE}/developers`,
            headline: 'ConcordiaTracker developer resources',
            description: 'API reference, OpenAPI specification, and conventions for automated clients.',
            author: { '@id': `${SITE}/#organization` },
            publisher: { '@id': `${SITE}/#organization` },
          },
          {
            '@type': 'WebAPI',
            '@id': `${SITE}/#api`,
            name: 'ConcordiaTracker API',
            description:
              'Course and section lookup, support tickets, billing, and notifications for ' +
              'ConcordiaTracker.',
            documentation: `${SITE}/developers`,
            provider: { '@id': `${SITE}/#organization` },
            termsOfService: `${SITE}/terms`,
          },
        ],
      },
    },
  ]

  for (const page of standalone) {
    const dir = path.join(dist, page.slug)
    await mkdir(dir, { recursive: true })
    await writeFile(
      path.join(dir, 'index.html'),
      shell({
        title: page.title,
        description: page.description,
        slug: page.slug,
        bodyHtml: markdownToHtml(page.md),
        jsonLd: page.jsonLd,
      }),
      'utf8',
    )
    await writeFile(path.join(dir, 'index.md'), page.md, 'utf8')
    written.push(`${page.slug}/index.html`, `${page.slug}/index.md`)
  }

  /* 3. The homepage: real content and JSON-LD inside the shipped index.html.
        Everything below derives from ONE pristine shell, so re-running the
        build over an already-injected dist/ replaces rather than compounds. */
  const indexPath = path.join(dist, 'index.html')
  const built = await readFile(indexPath, 'utf8')
  const appShell = setRootContent(built, '')

  let html = setRootContent(appShell, homeFallbackHtml())
  if (!html.includes('application/ld+json')) {
    html = html.replace(
      '</head>',
      `    <link rel="alternate" type="text/markdown" href="${SITE}/index.md" />
` +
        `    <script type="application/ld+json">${JSON.stringify(homeJsonLd())}</script>
  </head>`,
    )
  }
  await writeFile(indexPath, html, 'utf8')
  written.push('index.html (content + JSON-LD)')
  await writeFile(path.join(dist, 'index.md'), homeMarkdown(), 'utf8')
  written.push('index.md')

  /* 4. Legal documents, prerendered into a copy of the shell. */
  const legal = await loadLegalDocs()
  const prerenderDir = path.join(dist, 'prerendered')
  await mkdir(prerenderDir, { recursive: true })
  const aliases = { terms: 'terms', privacy: 'privacy', privacypolicy: 'privacy', educator: 'educator' }
  let legalOk = 0
  for (const [route, docSlug] of Object.entries(aliases)) {
    const doc = legal?.[docSlug]
    const body = doc
      ? legalBlocksToHtml(doc)
      : `<div id="ct-prerender" style="max-width:46rem;margin:0 auto;padding:40px 22px;font:16px/1.65 Inter,system-ui,sans-serif;color:#b9b7c4;background:#0f0f16"><h1 style="color:#f2f1f6">${esc(docSlug)}</h1><p>Loading the full document. If it does not appear, read it at <a href="${SITE}/${route}" style="color:#8fb39a">${SITE}/${route}</a>.</p></div>`
    if (doc) legalOk++
    const page = setRootContent(appShell, body)
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${esc(doc?.title ?? route)} · ConcordiaTracker</title>`,
      )
      .replace(
        /<link rel="canonical" href="[^"]*" \/>/,
        `<link rel="canonical" href="${SITE}/${route}" />`,
      )
    await writeFile(path.join(prerenderDir, `${route}.html`), page, 'utf8')
    written.push(`prerendered/${route}.html`)
  }

  return { written, legalOk, legalTotal: Object.keys(aliases).length }
}
