/**
 * Checks the things that make this site readable by an agent, against the build
 * output rather than against intentions.
 *
 * Everything here was a real failure at some point:
 *
 *   - the homepage shipped 76 characters of text and an empty #root,
 *   - unknown paths returned 200 with the app shell,
 *   - there was no OpenAPI document,
 *   - errors came back as HTML,
 *   - and nothing declared Vary: Accept.
 *
 * Static checks (files, specs, JSON-LD, routing rules) run offline against
 * dist/ and are wired into `npm test`. The live HTTP checks only run when a
 * base URL is given, because they need a deployment:
 *
 *   node scripts/verify-agent-readiness.mjs --live https://concordiatracker.com
 *
 * ROUTING NOTE. vercel.json cannot carry comments, so the reasoning lives here.
 * The SPA rewrite is an allowlist, not a catch-all: every route the React
 * router knows is listed, and everything else falls through to /api/not-found,
 * which returns a real 404. The one subtle rule is `/:handle([a-z0-9_]{3,20})`
 * — public profiles are top-level paths, so a bare word could be a real page.
 * It is bounded by HANDLE_RE from src/features/onboarding/handle.ts, which
 * excludes hyphens and dots, so a probe like /some-path-that-does-not-exist
 * cannot be mistaken for a profile.
 */
import { readFile, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

let failures = 0
let checks = 0

function check(name, ok, detail = '') {
  checks++
  if (ok) {
    console.log(`  ok    ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failures++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
  return ok
}

function section(title) {
  console.log(`\n${title}`)
}

const read = (p) => readFile(path.join(DIST, p), 'utf8')
const has = async (p) => {
  try {
    await access(path.join(DIST, p))
    return true
  } catch {
    return false
  }
}

/** Text a crawler would see: tags stripped, whitespace collapsed. */
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

if (!existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}

/* ── 1. Homepage content without JavaScript ───────────────────────────────── */
section('Content without JavaScript')
{
  const { rootSpan } = await import('../docs-src/agent-pages.mjs')
  const html = await read('index.html')
  const span = rootSpan(html)
  const inner = span ? html.slice(span.contentStart, span.contentEnd) : ''
  const text = textOf(inner)
  check('homepage has an <h1> in raw HTML', /<h1[\s>]/.test(inner))
  check('homepage ships 500+ chars of text', text.length >= 500, `${text.length} chars`)
  check('homepage names the product', /ConcordiaTracker/.test(text))
  check('homepage links to the docs', /href="\/docs\//.test(inner))
  check('homepage links to developer resources', /href="\/developers"/.test(inner))

  // The fallback must be invisible to anyone running JavaScript. It sat visible
  // for a few hundred milliseconds before React mounted, which read as the page
  // flashing the hero and the FAQ and then replacing them.
  check('the fallback is hidden once JS runs', /\.js #ct-prerender\s*\{[^}]*display:\s*none/.test(html))
  check(
    'the js class is set in <head>, before the body paints',
    html.indexOf("className += ' js'") > -1 &&
      html.indexOf("className += ' js'") < html.indexOf('<body'),
  )
  check('the fallback is still in the document for crawlers', /id="ct-prerender"/.test(html))
}

/* ── 2. Structured data ───────────────────────────────────────────────────── */
section('JSON-LD structured data')
{
  const html = await read('index.html')
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  if (check('homepage carries JSON-LD', blocks.length > 0, `${blocks.length} block(s)`)) {
    let parsed = null
    try {
      parsed = JSON.parse(blocks[0][1])
    } catch (err) {
      check('JSON-LD parses', false, err.message)
    }
    if (parsed) {
      check('JSON-LD parses', true)
      const nodes = parsed['@graph'] ?? [parsed]
      const types = nodes.map((n) => n['@type'])
      check('declares SoftwareApplication', types.includes('SoftwareApplication'))
      check('declares Organization', types.includes('Organization'))
      check('declares FAQPage', types.includes('FAQPage'))

      const org = nodes.find((n) => n['@type'] === 'Organization')
      check('Organization has name, url, description', !!(org?.name && org?.url && org?.description))
      check('Organization has contactPoint with email', !!org?.contactPoint?.[0]?.email)
      check('contactPoint declares a contactType', !!org?.contactPoint?.[0]?.contactType)
      check(
        'Organization has a PostalAddress',
        org?.address?.['@type'] === 'PostalAddress' && !!org.address.addressCountry,
      )

      const app = nodes.find((n) => n['@type'] === 'SoftwareApplication')
      check('SoftwareApplication has offers', Array.isArray(app?.offers) && app.offers.length > 0)
      check(
        'every offer has price and currency',
        (app?.offers ?? []).every((o) => o.price !== undefined && !!o.priceCurrency),
      )
    }
  }
}

/* ── 3. OpenAPI ───────────────────────────────────────────────────────────── */
section('OpenAPI specification')
{
  const mod = await import('../api/_openapi.ts').catch(() => null)
  const spec = mod?.OPENAPI
  if (check('spec module loads', !!spec)) {
    check('spec parses as JSON', (() => {
      try {
        JSON.parse(JSON.stringify(spec))
        return true
      } catch {
        return false
      }
    })())
    check('declares an OpenAPI version', /^3\./.test(spec.openapi), spec.openapi)
    check('has info.title, version, description', !!(spec.info?.title && spec.info?.version && spec.info?.description))
    check('has a contact', !!spec.info?.contact?.email)
    check('declares servers', Array.isArray(spec.servers) && spec.servers.length > 0)

    const ops = []
    for (const [p, item] of Object.entries(spec.paths ?? {})) {
      for (const [method, op] of Object.entries(item)) {
        ops.push({ p, method, op })
      }
    }
    check('describes at least one operation', ops.length > 0, `${ops.length} operations`)

    const ids = ops.map((o) => o.op.operationId).filter(Boolean)
    check('every operation has an operationId', ids.length === ops.length)
    check('operationIds are unique', new Set(ids).size === ids.length)
    check(
      'every operation has a description',
      ops.every((o) => typeof o.op.description === 'string' && o.op.description.length > 30),
    )
    check(
      'every operation has a summary',
      ops.every((o) => !!o.op.summary),
    )
    check(
      'every operation documents a 200 response with a schema',
      ops.every((o) => !!o.op.responses?.['200']?.content?.['application/json']?.schema),
    )
    check(
      'every parameter is typed and described',
      ops.every((o) =>
        (o.op.parameters ?? []).every((prm) => !!prm.schema?.type && !!prm.description),
      ),
    )
    check(
      'every request body has a schema',
      ops.every((o) => !o.op.requestBody || !!o.op.requestBody.content?.['application/json']?.schema),
    )
    check('defines an Error schema', !!spec.components?.schemas?.Error)
    check(
      'Error schema requires a machine-readable code',
      (spec.components?.schemas?.Error?.required ?? []).includes('code'),
    )
    check('defines security schemes', Object.keys(spec.components?.securitySchemes ?? {}).length > 0)

    // Function calling: a tool definition needs a name, a description, and a
    // parameter object. Anything failing this cannot be auto-converted.
    const fnReady = ops.filter(
      (o) =>
        /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(o.op.operationId ?? '') &&
        (o.op.description ?? '').length > 30,
    )
    check(
      'every operation is function-calling compatible',
      fnReady.length === ops.length,
      `${fnReady.length}/${ops.length}`,
    )
  }
}

/* ── 4. Error responses ───────────────────────────────────────────────────── */
section('JSON error responses')
{
  const files = ['sections.ts', 'ticket.ts', 'stripe-checkout.ts', 'stripe-billing.ts', 'send-push.ts', 'sync-catalog.ts', 'run-reminders.ts', 'stripe-webhook.ts']
  let stragglers = []
  for (const f of files) {
    const src = await readFile(path.join(ROOT, 'api', f), 'utf8')
    // A bare res.status(4xx|5xx).json({ error: ... }) means it bypassed the
    // shared shape and will not carry a code or a hint.
    const bare = [...src.matchAll(/res\.status\([45]\d\d\)\.json\(\{\s*error:/g)]
    // sync-catalog keeps one hand-written body that already includes the fields.
    if (bare.length && f !== 'sync-catalog.ts') stragglers.push(`${f}:${bare.length}`)
  }
  check('all handlers use the shared error shape', stragglers.length === 0, stragglers.join(' '))
  check('shared error helper exists', existsSync(path.join(ROOT, 'api', '_respond.ts')))
  const respond = await readFile(path.join(ROOT, 'api', '_respond.ts'), 'utf8')
  for (const field of ['code', 'message', 'hint', 'status', 'docs']) {
    check(`error body includes ${field}`, new RegExp(`${field}[?]?:`).test(respond))
  }
  const catchAll = path.join(ROOT, 'api', '[...path].ts')
  check('there is an /api catch-all', existsSync(catchAll))
  if (existsSync(catchAll)) {
    // Checked at source level: this module imports './_respond.js', which only
    // resolves under a TypeScript-aware build, so it cannot simply be imported
    // here. `tsc -p api` covers the compile; this covers the behaviour.
    const src = await readFile(catchAll, 'utf8')
    check('the catch-all answers 404', /fail\(res,\s*404/.test(src))
    check('the catch-all points at the spec', /openapi\.json/.test(src))
  }
}

/* ── 5. Markdown content negotiation ──────────────────────────────────────── */
section('Markdown content negotiation')
{
  check('dist/index.md exists', await has('index.md'))
  const md = await read('index.md')
  check('index.md opens with an H1', /^#\s+\S/.test(md))
  check('index.md has real content', md.length >= 500, `${md.length} chars`)

  const { flatten } = await import('../docs-src/content.mjs')
  const pages = flatten()
  let missing = []
  for (const p of pages) if (!(await has(path.join('docs', p.slug, 'index.md')))) missing.push(p.slug)
  check('every docs page has a markdown twin', missing.length === 0, missing.join(', '))

  for (const p of ['about', 'contact', 'developers']) {
    check(`${p}/index.md exists`, await has(path.join(p, 'index.md')))
  }

  const vercel = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf8'))

  // Negotiation is done by middleware, not by a `has` condition on a rewrite.
  // Two deploys proved the rewrite form never fires — and it could never have
  // worked for `/` regardless, since Vercel consults the filesystem first and
  // `/` resolves to a real index.html. See middleware.ts.
  const mw = await readFile(path.join(ROOT, 'middleware.ts'), 'utf8')
  check('middleware handles Accept: text/markdown', mw.includes('text') && mw.includes('markdown'))
  const matcher = mw.match(/matcher:\s*\[([^\]]*)\]/)?.[1] ?? ''
  for (const p of ['/', '/about', '/contact', '/developers', '/docs/:path*']) {
    check(`middleware matches ${p}`, matcher.includes(`'${p}'`))
  }
  check('middleware sets Vary on the markdown variant', /Vary:\s*'Accept/.test(mw))
  check('middleware falls through when markdown is not asked for', /return undefined/.test(mw))
  check(
    'no dead accept-conditioned rewrites remain',
    !vercel.rewrites.some((r) => (r.has ?? []).some((h) => h.key === 'accept')),
  )
  const varyRules = vercel.headers.filter((h) =>
    h.headers.some((x) => x.key === 'Vary' && /Accept/.test(x.value)),
  )
  check('Vary: Accept is declared', varyRules.length >= 3, `${varyRules.length} rules`)
  const mdType = vercel.headers.find((h) => /\.md/.test(h.source))
  check(
    'markdown files declare text/markdown',
    !!mdType?.headers.some((x) => x.key === 'Content-Type' && /text\/markdown/.test(x.value)),
  )
}

/* ── 6. Routing: real 404s ────────────────────────────────────────────────── */
section('Agent-friendly 404s')
{
  const vercel = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf8'))
  const last = vercel.rewrites[vercel.rewrites.length - 1]
  check('the final rewrite is a 404 catch-all', last.destination === '/api/not-found', last.destination)
  check('a 404 handler exists', existsSync(path.join(ROOT, 'api', 'not-found.ts')))

  const nf = await readFile(path.join(ROOT, 'api', 'not-found.ts'), 'utf8')
  check('404 handler sets status 404', /status\(404\)/.test(nf))
  check('404 body offers markdown', /text\/markdown/.test(nf))
  check('404 body points at llms.txt', /llms\.txt/.test(nf))
  check('404 body points at the sitemap', /sitemap\.xml/.test(nf))

  check(
    'the SPA rewrite is an allowlist, not a catch-all',
    !vercel.rewrites.some((r) => r.destination === '/index.html' && r.source === '/:path*'),
  )
  const handleRule = vercel.rewrites.find((r) => /handle/.test(r.source))
  check('profile handles are bounded by a pattern', !!handleRule, handleRule?.source)

  // The pattern must not swallow a probe path. Mirrors HANDLE_RE.
  const handleSrc = await readFile(
    path.join(ROOT, 'src', 'features', 'onboarding', 'handle.ts'),
    'utf8',
  )
  const re = handleSrc.match(/HANDLE_RE\s*=\s*\/(.+?)\//)
  // Test what the pattern DOES, not how it reads: [a-z0-9_] contains hyphens
  // as range separators, so grepping the source for '-' is meaningless.
  const rePattern = new RegExp(re[1])
  check('HANDLE_RE was found', !!re, re?.[1])
  check('a plain handle still routes to the app', rePattern.test('alex_d'))
  check(
    'a hyphenated probe path is not a valid handle',
    !rePattern.test('some-path-that-does-not-exist'),
  )
  check('a dotted path is not a valid handle', !rePattern.test('foo.bar'))
  check('an over-long path is not a valid handle', !rePattern.test('a'.repeat(21)))
}

/* ── 7. Trust anchors and discoverability ─────────────────────────────────── */
section('Trust anchors and discoverability')
{
  for (const page of ['about', 'contact', 'developers']) {
    const html = await read(path.join(page, 'index.html'))
    const text = textOf(html)
    check(`/${page} has 500+ chars`, text.length >= 500, `${text.length} chars`)
    check(`/${page} has an <h1>`, /<h1[\s>]/.test(html))
    check(`/${page} names the product in its title`, /<title>[^<]*ConcordiaTracker/.test(html))
    check(`/${page} carries JSON-LD`, /application\/ld\+json/.test(html))
  }

  // The Educator Agreement is still a draft of placeholder sections, so it has
  // less text than the others by design. It is checked, at a lower bar, rather
  // than skipped — the point is that the route serves the real document.
  const legalFloor = { terms: 500, privacy: 500, privacypolicy: 500, educator: 300 }
  for (const doc of ['terms', 'privacy', 'privacypolicy', 'educator']) {
    const { rootSpan } = await import('../docs-src/agent-pages.mjs')
    const html = await read(path.join('prerendered', `${doc}.html`))
    const span = rootSpan(html)
    const text = textOf(span ? html.slice(span.contentStart, span.contentEnd) : '')
    check(
      `/${doc} prerenders ${legalFloor[doc]}+ chars`,
      text.length >= legalFloor[doc],
      `${text.length} chars`,
    )
    // Guards the exact bug that shipped once: the legal shell carrying the
    // homepage's hero instead of the policy.
    check(`/${doc} contains the policy, not the homepage`, !/Stop guessing/.test(text))
  }

  // The docs sidebar disappeared once already: it was a <details> held open on
  // desktop by styling its child, and Chrome now hides collapsed <details>
  // content through ::details-content, which no child style can override. It is
  // a checkbox disclosure now, and these pin both halves of that.
  const doc = await read(path.join('docs', 'introduction', 'index.html'))
  const navLinks = (doc.match(/class="nav-group"/g) ?? []).length
  check('docs page renders its sidebar groups', navLinks >= 5, `${navLinks} groups`)
  check(
    'sidebar links are present in the markup',
    (doc.match(/<li><a href="\/docs\//g) ?? []).length >= 30,
  )
  check('the sidebar is not gated behind <details>', !/<details[^>]*nav-shell/.test(doc))
  check('the mobile disclosure is a checkbox', /id="nav-toggle"/.test(doc))

  // The Support control is a <button> beside an <a> styled identically; without
  // an explicit background it renders in the UA's grey.
  const shellCss = await readFile(path.join(ROOT, 'docs-src', 'render.mjs'), 'utf8')
  check(
    'the header buttons declare a background',
    /\.portal\{[^}]*background:transparent/.test(shellCss),
  )
  check('the support form has no native dropdown on screen', /support-native/.test(shellCss))
  check('the custom dropdown is keyboard-driven', /aria-activedescendant/.test(shellCss))
  check(
    'the native select survives for no-JS callers',
    /<select id="s-cat">/.test(doc) && (doc.match(/<option/g) ?? []).length >= 5,
  )

  const llms = await read('llms.txt')
  check('llms.txt has a when-to-use section', /##\s*When to use/i.test(llms))
  check('llms.txt names concrete use cases', /api\/sections/.test(llms))
  check('llms.txt says what NOT to use it for', /NOT use it/i.test(llms))
  check('llms.txt links the OpenAPI spec', /openapi\.json/.test(llms))
  check('llms.txt links the developer page', /\/developers/.test(llms))
  check('llms.txt documents markdown negotiation', /Accept: text\/markdown/.test(llms))

  const sitemap = await read('sitemap.xml')
  for (const p of ['/about', '/contact', '/developers']) {
    check(`sitemap lists ${p}`, sitemap.includes(`concordiatracker.com${p}<`))
  }

  const robots = await read('robots.txt')
  check('robots.txt points at the sitemap', /Sitemap:/i.test(robots))
  check('robots.txt points at llms.txt', /llms\.txt/.test(robots))
}

/* ── 8. Homepage copy has not drifted from the app ────────────────────────── */
section('Homepage copy matches the app')
{
  const { HOME } = await import('../docs-src/agent-pages.mjs')
  const en = await readFile(path.join(ROOT, 'src', 'i18n', 'en.ts'), 'utf8')
  check(
    'hero body still matches src/i18n/en.ts',
    en.includes(HOME.body),
    'update HOME.body in docs-src/agent-pages.mjs if the landing copy changed',
  )
  const heroWords = HOME.h1.replace(/[.’']/g, '').split(' ')[0]
  check('hero headline still recognisable in en.ts', en.includes(heroWords))
}

/* ── 9. Live checks, only with --live ─────────────────────────────────────── */
const liveIdx = process.argv.indexOf('--live')
if (liveIdx > -1) {
  const base = (process.argv[liveIdx + 1] ?? 'https://concordiatracker.com').replace(/\/$/, '')
  section(`Live checks against ${base}`)

  const fetchSafe = async (url, init) => {
    try {
      return await fetch(url, init)
    } catch (err) {
      return { ok: false, status: 0, headers: new Map(), _err: err.message, text: async () => '' }
    }
  }

  const r404 = await fetchSafe(`${base}/some-path-that-does-not-exist`)
  check('unknown path returns 404', r404.status === 404, `got ${r404.status}`)

  const rApi = await fetchSafe(`${base}/api/definitely-not-an-endpoint`)
  check('unknown API path returns 404', rApi.status === 404, `got ${rApi.status}`)
  check(
    'unknown API path returns JSON',
    /application\/json/.test(rApi.headers.get?.('content-type') ?? ''),
  )

  const rSpec = await fetchSafe(`${base}/openapi.json`)
  check('/openapi.json returns 200', rSpec.status === 200, `got ${rSpec.status}`)
  if (rSpec.status === 200) {
    const body = await rSpec.text()
    let ok = true
    try {
      JSON.parse(body)
    } catch {
      ok = false
    }
    check('/openapi.json is valid JSON', ok)
  }

  const rMd = await fetchSafe(`${base}/`, { headers: { Accept: 'text/markdown' } })
  const ct = rMd.headers.get?.('content-type') ?? ''
  const vary = rMd.headers.get?.('vary') ?? ''
  check('homepage honours Accept: text/markdown', /text\/markdown/.test(ct), ct)
  check('homepage sends Vary: Accept', /accept/i.test(vary), vary || '(none)')

  const rHtml = await fetchSafe(`${base}/`)
  const html = await rHtml.text()
  check('homepage HTML has 500+ chars of text', textOf(html).length >= 500)

  const rSections = await fetchSafe(`${base}/api/sections?subject=NOPE`)
  check('a bad request returns 400', rSections.status === 400, `got ${rSections.status}`)
  if (rSections.status === 400) {
    const body = JSON.parse(await rSections.text())
    check('error body carries a code', !!body.code, body.code)
    check('error body carries a hint', !!body.hint)
  }

  for (const p of ['/about', '/contact', '/developers', '/privacy']) {
    const r = await fetchSafe(`${base}${p}`)
    const t = textOf(await r.text())
    check(`${p} serves 500+ chars`, r.status === 200 && t.length >= 500, `${r.status}, ${t.length} chars`)
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`)
process.exit(failures === 0 ? 0 : 1)
