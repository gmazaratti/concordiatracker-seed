/**
 * The keyword landing pages and the FAQ, written as finished HTML.
 *
 * These pages are React routes, and before this a crawler that did not run
 * JavaScript received the HOMEPAGE for every one of them: its title, its
 * headline, its description. Search Console showed the cost — hundreds of
 * impressions for "concordia gpa scale" and "concordia schedule builder" with
 * almost no clicks, because Google had no page-specific title to show.
 *
 * Each page here is the app shell with the real content already inside #root
 * and its own <head>. React clears #root when it mounts, so a person sees the
 * normal page; a crawler reads this. The words come from the same modules the
 * React pages read (seo-pages-data.ts, faq-data.ts, en.ts, grade-scale.ts),
 * so the two cannot drift apart.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { esc } from './render.mjs'

const SITE = 'https://concordiatracker.com'

const WRAP =
  'max-width:46rem;margin:0 auto;padding:40px 22px 64px;font:16px/1.65 Inter,system-ui,sans-serif;color:#b9b7c4;background:#0f0f16'
const H1 = 'font-size:34px;line-height:1.12;margin:0 0 14px;color:#f2f1f6;font-weight:600'
const H2 = 'font-size:22px;line-height:1.25;margin:36px 0 10px;color:#f2f1f6;font-weight:600'
const LINK = 'color:#8fb39a'

/** Swap one head tag's content. Throws if the tag is missing, so a change to
 *  index.html cannot silently leave a page carrying the homepage's text. */
function setMeta(html, attr, name, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`)
  if (!re.test(html)) throw new Error(`seo-pages: <meta ${attr}="${name}"> not found in index.html`)
  return html.replace(re, `$1${esc(value)}$2`)
}

function withHead(shell, { title, description, url, jsonLd }) {
  let html = shell
    // The homepage's own structured data describes the homepage; drop it.
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
  // index.html writes the description metas over several lines.
  html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
  html = setMeta(html, 'property', 'og:title', title)
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'name', 'twitter:title', title)
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
  if (!html.includes(`<title>${esc(title)}</title>`)) throw new Error(`seo-pages: title not set for ${url}`)
  const ld = JSON.stringify(jsonLd).replace(/</g, '\\u003c')
  return html.replace('</head>', `    <script type="application/ld+json">${ld}</script>\n  </head>`)
}

function faqLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

function scaleTableHtml(scale) {
  const rows = scale
    .map((b, i) => {
      const top = i === 0 ? 100 : scale[i - 1].min - 1
      const pct = b.min === 0 ? 'below 50' : `${b.min}–${top}`
      return `<tr><th scope="row" style="text-align:left;padding:6px 12px;color:#f2f1f6">${esc(b.letter)}</th><td style="padding:6px 12px;color:#f2f1f6">${b.points.toFixed(2)}</td><td style="padding:6px 12px">${pct}</td></tr>`
    })
    .join('')
  return `<table style="border-collapse:collapse;margin-top:14px"><caption style="text-align:left;padding-bottom:6px">Concordia 4.30 grade scale</caption><thead><tr><th style="text-align:left;padding:6px 12px">Letter</th><th style="text-align:left;padding:6px 12px">Grade points</th><th style="text-align:left;padding:6px 12px">Common percentage</th></tr></thead><tbody>${rows}</tbody></table>`
}

function landingBody(page, scale) {
  const sections = page.sections
    .map((s) => `<h2 style="${H2}">${esc(s.h2)}</h2><p>${esc(s.body)}</p>${s.scaleTable ? scaleTableHtml(scale) : ''}`)
    .join('')
  const faqs = page.faqs.map((f) => `<h3 style="color:#f2f1f6;margin:20px 0 4px">${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')
  const related = page.related.map((r) => `<a href="${r.to}" style="${LINK}">${esc(r.label)}</a>`).join(' · ')
  return `<div id="ct-prerender" style="${WRAP}">
<p style="letter-spacing:.2em;text-transform:uppercase;font-size:12px">For Concordia students</p>
<h1 style="${H1}">${esc(page.h1)}</h1>
<p>${esc(page.intro)}</p>
<p><a href="${page.cta.to}" style="${LINK}">${esc(page.cta.label)}</a></p>
${sections}
<h2 style="${H2}">Common questions</h2>
${faqs}
<p style="margin-top:36px"><a href="/" style="${LINK}">ConcordiaTracker home</a> · ${related}</p>
<p style="font-size:13px;margin-top:24px">Not affiliated with Concordia University.</p>
</div>`
}

/** `[label](href)` in an FAQ answer becomes a link; everything else is escaped. */
function answerHtml(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    out.push(esc(text.slice(last, m.index)))
    out.push(`<a href="${esc(m[2])}" style="${LINK}">${esc(m[1])}</a>`)
    last = m.index + m[0].length
  }
  out.push(esc(text.slice(last)))
  return out.join('')
}

export async function writeSeoPages({ dist, appShell, setRootContent }) {
  const { SEO_PAGES } = await import('../src/features/landing/seo-pages-data.ts')
  const { GRADE_SCALE } = await import('../src/lib/grade-scale.ts')
  const { FAQ_GROUPS, qKey, aKey, plainAnswer } = await import('../src/features/faq/faq-data.ts')
  const { en } = await import('../src/i18n/en.ts')

  const dir = path.join(dist, 'prerendered')
  await mkdir(dir, { recursive: true })
  const written = []

  for (const page of Object.values(SEO_PAGES)) {
    const url = `${SITE}${page.path}`
    const html = withHead(setRootContent(appShell, landingBody(page, GRADE_SCALE)), {
      title: page.title,
      description: page.description,
      url,
      jsonLd: faqLd(page.faqs),
    })
    const file = `${page.path.slice(1)}.html`
    await writeFile(path.join(dir, file), html, 'utf8')
    written.push(`prerendered/${file}`)
  }

  if (en) {
    const t = (k) => en[k] ?? k
    const groups = FAQ_GROUPS.map(
      (g) =>
        `<h2 style="${H2}">${esc(t(g.title))}</h2>` +
        g.items.map((id) => `<h3 style="color:#f2f1f6;margin:20px 0 4px">${esc(t(qKey(id)))}</h3><p>${answerHtml(t(aKey(id)))}</p>`).join(''),
    ).join('')
    const body = `<div id="ct-prerender" style="${WRAP}"><h1 style="${H1}">${esc(t('faqPage.heading'))}</h1><p>${esc(t('faqPage.intro'))}</p>${groups}<p style="font-size:13px;margin-top:24px">Not affiliated with Concordia University.</p></div>`
    const faqs = FAQ_GROUPS.flatMap((g) => g.items.map((id) => ({ q: t(qKey(id)), a: plainAnswer(t(aKey(id))) })))
    const html = withHead(setRootContent(appShell, body), {
      title: t('faqPage.metaTitle'),
      description: t('faqPage.metaDescription'),
      url: `${SITE}/faq`,
      jsonLd: faqLd(faqs),
    })
    await writeFile(path.join(dir, 'faq.html'), html, 'utf8')
    written.push('prerendered/faq.html')
  }
  return written
}
