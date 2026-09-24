/**
 * Simulates Vercel's rewrite matching against vercel.json, so the 404 rule can
 * be trusted before it reaches production.
 *
 * The risk this exists to catch is asymmetric. A rewrite that is too narrow
 * turns a working page into a 404 — loud, and caught by anyone clicking. A
 * rewrite that is too broad turns every unknown path back into a soft 200,
 * which is silent and is exactly the failure being fixed. So both directions
 * are asserted here: every route the React router serves must reach the app,
 * and a list of paths that are genuinely nothing must reach /api/not-found.
 *
 * Static files are matched by the filesystem before rewrites run, so anything
 * with a real file in dist/ is checked against dist/ rather than the rules.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

let failures = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}${detail ? ` — ${detail}` : ''}`)
  else {
    failures++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/**
 * Translate a Vercel `source` pattern into a RegExp.
 *
 * Supports the two forms this config uses: `:name(regex)` with an inline
 * pattern, and `:name*` / `:name` segment captures.
 */
function toRegExp(source) {
  let out = ''
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === ':') {
      let j = i + 1
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++
      const name = source.slice(i + 1, j)
      const rest = source.slice(j)
      if (rest.startsWith('(')) {
        // :name(pattern) — copy the inner pattern verbatim, balancing parens.
        let depth = 0
        let k = j
        for (; k < source.length; k++) {
          if (source[k] === '(') depth++
          else if (source[k] === ')') {
            depth--
            if (depth === 0) break
          }
        }
        out += `(?<${name}>${source.slice(j + 1, k)})`
        i = k + 1
        if (source[i] === '*') {
          out += '*'
          i++
        }
      } else if (rest.startsWith('*')) {
        out += `(?<${name}>.*)`
        i = j + 1
      } else {
        out += `(?<${name}>[^/]+)`
        i = j
      }
      continue
    }
    if ('.+?^${}|[]\\'.includes(ch)) out += `\\${ch}`
    else out += ch
    i++
  }
  return new RegExp(`^${out}$`)
}

const vercel = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf8'))

/** First matching rewrite, ignoring header-conditional ones unless asked. */
function resolve(pathname, { markdown = false } = {}) {
  for (const rule of vercel.rewrites) {
    const conditional = (rule.has ?? []).some((h) => h.key === 'accept')
    if (conditional && !markdown) continue
    const m = toRegExp(rule.source).exec(pathname)
    if (!m) continue
    // Substitute the captured params the way Vercel does. Without this the
    // test would only compare destination templates and would never catch a
    // rule that captures the wrong segment.
    let dest = rule.destination
    for (const [key, value] of Object.entries(m.groups ?? {})) {
      // `:name*` FIRST. Replacing `:name` alone leaves the asterisk stranded
      // in the destination — `path=owner/overview*` — which is not what Vercel
      // produces and would have let a wrong wildcard destination pass here.
      dest = dest.split(`:${key}*`).join(value ?? '')
      dest = dest.split(`:${key}`).join(value ?? '')
    }
    return dest
  }
  return null
}

/** Does a concrete file exist in dist for this path? Filesystem wins. */
const isStatic = (p) => existsSync(path.join(DIST, p.replace(/^\//, '')))

console.log('\nRoutes that must reach the app')
// Every path pattern the React router declares, with realistic values.
const appRoutes = [
  '/app',
  '/app/courses',
  '/app/courses/blueprints',
  '/app/courses/abc-123',
  '/app/calendar',
  '/app/planner',
  '/app/community/org/hackconcordia',
  '/app/requests',
  '/teacher',
  '/teacher/invite/demo-comm217',
  '/teacher/course/xyz',
  '/organizer',
  '/organizer/event/ev-1',
  '/organizer/join/tok123',
  '/join/tok123',
  '/admin',
  '/feedback',
  '/survey',
  '/onboarding',
  '/demo',
  '/dev/landing',
  '/dev/landing/2',
  '/dev/login',
  '/e/ev-techfair',
  '/reset-password',
  '/r',
  '/s/sometoken',
  '/legal/privacy',
  '/concordia-gpa-calculator',
  '/concordia-syllabus-tracker',
  '/alex_d',
  '/maya',
]
for (const r of appRoutes) {
  const dest = resolve(r)
  check(`${r} → app shell`, dest === '/index.html', dest ?? '(no match)')
}

console.log('\nLegal routes that must reach a prerendered document')
for (const r of ['/terms', '/privacy', '/privacypolicy', '/educator']) {
  const dest = resolve(r)
  const ok = dest?.startsWith('/prerendered/')
  check(`${r} → prerendered`, !!ok, dest ?? '(no match)')
  if (ok) check(`${r} target exists`, isStatic(dest), dest)
}

console.log('\nGenerated pages that must reach their HTML')
for (const [r, expected] of [
  ['/docs', '/docs/index.html'],
  ['/docs/introduction', '/docs/introduction/index.html'],
  ['/about', '/about/index.html'],
  ['/contact', '/contact/index.html'],
  ['/developers', '/developers/index.html'],
]) {
  const dest = resolve(r)
  check(`${r} → ${expected}`, dest === expected, dest ?? '(no match)')
  check(`${expected} exists`, isStatic(expected))
}

console.log('\nThe spec')
// The spec used to be served by a serverless function. It is a CONSTANT, so
// the docs build writes it to disk instead - which freed one of the twelve
// Hobby function slots for Moodle sync. Vercel consults the filesystem BEFORE
// rewrites, so what matters now is that nothing rewrites these paths away from
// the real files, and that the build actually produced them.
// Both DO match the `/:path*` catch-all, exactly as llms.txt and sitemap.xml
// do, and are served anyway because Vercel consults the filesystem before it
// applies a rewrite. So the thing to assert is that the build produced them.
check(
  'they are in the same position as the other static files',
  resolve('/openapi.json') === resolve('/llms.txt'),
  `openapi ${resolve('/openapi.json')} vs llms ${resolve('/llms.txt')}`,
)
check('the build emits openapi.json', isStatic('/openapi.json'))
check('and .well-known/openapi.json', isStatic('/.well-known/openapi.json'))

console.log('\nPublic profiles')
// The app route is `/@handle`, and the rewrite pattern was written from
// HANDLE_RE — which is the BARE handle. So `/@alex` never reached the app at
// all and answered a genuine 404 in production, while `/alex` reached the app
// and rendered its own not-found. Neither form worked, and nothing here tested
// it. Both must reach the SPA now; `/alex` redirects to the canonical form.
for (const r of ['/@alex', '/@ginacody', '/alex', '/@a_b_c']) {
  const dest = resolve(r)
  check(`${r} → the app`, dest === '/index.html', dest ?? '(no match)')
}
// Still not a handle: too short, too long, or characters HANDLE_RE rejects.
for (const r of ['/@ab', '/@' + 'a'.repeat(21), '/@Alex', '/@al-ex']) {
  const dest = resolve(r)
  check(`${r} → 404`, dest === '/api/not-found', dest ?? '(no match)')
}

console.log('\nThe v1 API')
// Every /api/v1 path is served by ONE function, because Hobby allows twelve
// and this project lives at the ceiling. A `[...path].ts` catch-all would have
// worked only if the filesystem is consulted before `/api/:path*` sends
// everything to the 404 — an assumption that has broken this project's routing
// twice. A named rewrite is checkable, so it is checked.
for (const r of [
  '/api/v1/owner/overview',
  '/api/v1/owner/users',
  '/api/v1/owner/payments',
  '/api/v1/owner/timeseries',
  '/api/v1/owner/ping',
  '/api/v1/me/courses',
  '/api/v1/me/assignments',
  '/api/v1/me/assignments/abc-123',
  '/api/v1/me/gpa',
  '/api/v1/me/calendar',
  '/api/v1/me/courses/6e0921df-57ae-411a-9b28-434ce9117e6a',
  '/api/v1/me/courses/from-outline',
  '/api/v1/me/assignments/507a45e5-ace8-45b1-a623-0f4ba2aba5b2/notes',
  '/api/v1/me/assignments/507a45e5-ace8-45b1-a623-0f4ba2aba5b2/grade',
  // The support desk. A thread id contains a COLON, which must survive the
  // rewrite intact or every lookup 404s.
  '/api/v1/support/threads',
  '/api/v1/support/threads/t:6f1c0a8e-1111-2222-3333-444455556666',
  '/api/v1/support/threads/t:6f1c0a8e-1111-2222-3333-444455556666/reply',
  '/api/v1/support/threads/d:6f1c0a8e-1111-2222-3333-444455556666',
  '/api/v1/support/kb',
  '/api/v1/support/kb/calendar-sync',
  '/api/v1/support/kb/search',
  '/api/v1/support/threads/t:6f1c0a8e-1111-2222-3333-444455556666/replies',
]) {
  const dest = resolve(r)
  check(`${r} reaches the v1 function`, dest === `/api/v1?path=${r.slice('/api/v1/'.length)}`, dest ?? '(no match)')
}
check('the bare /api/v1 index reaches it too', resolve('/api/v1') === '/api/v1?path=', resolve('/api/v1'))
// And the ordering still holds: anything else under /api is a real 404.
check('an unknown /api path is still a 404', resolve('/api/nope') === '/api/not-found?json=1', resolve('/api/nope'))

console.log('\nEndpoints that share a function')
// stripe-checkout has no file of its own any more; it rides on stripe-billing
// so the twelfth slot could go to v1. The PUBLIC URL must not change — the
// browser client and the OpenAPI spec both name it.
check(
  '/api/stripe-checkout still resolves',
  resolve('/api/stripe-checkout') === '/api/stripe-billing?a=checkout',
  resolve('/api/stripe-checkout'),
)
check('/api/library still resolves', resolve('/api/library') === '/api/sections?feed=library', resolve('/api/library'))


console.log('\nPaths that must return a real 404')
const notFound = [
  '/some-path-that-does-not-exist',
  '/this/is/not/a/page',
  '/app-not-real',
  '/x',
  '/a'.repeat(1) + 'b'.repeat(40),
  '/Uppercase',
  '/has.dot',
  '/wp-admin',
  '/.env',
  '/docs/introduction/extra',
  '/dev/nothing',
]
for (const r of notFound) {
  const dest = resolve(r)
  check(`${r} → 404`, dest === '/api/not-found', dest ?? '(no match)')
}

console.log('\nMarkdown negotiation (middleware, ahead of the rewrite table)')
// Negotiation is NOT in the rewrite table. `has` conditions on the accept
// header were deployed twice, bare and grouped, and never fired -- and could
// never have worked for `/` regardless, because Vercel consults the filesystem
// first and `/` is a real index.html. Middleware runs ahead of both.
//
// What the rewrite table still owes is that the markdown targets exist, and
// that an ordinary request for the same URL keeps resolving to HTML.
const middleware = await readFile(path.join(ROOT, 'middleware.ts'), 'utf8')
const matcher = middleware.match(/matcher:\s*\[([^\]]*)\]/)?.[1] ?? ''
for (const [route, md] of [
  ['/', '/index.md'],
  ['/docs/introduction', '/docs/introduction/index.md'],
  ['/about', '/about/index.md'],
  ['/contact', '/contact/index.md'],
  ['/developers', '/developers/index.md'],
]) {
  const covered =
    matcher.includes(`'${route}'`) ||
    (route.startsWith('/docs/') && matcher.includes("'/docs/:path*'"))
  check(`middleware covers ${route}`, covered)
  check(`${md} exists for it to serve`, isStatic(md))
}
for (const [route, expected] of [
  ['/about', '/about/index.html'],
  ['/docs/introduction', '/docs/introduction/index.html'],
]) {
  check(`${route} without the header still resolves to HTML`, resolve(route) === expected)
}

console.log('\nStatic assets are served by the filesystem, not the rules')
for (const f of ['/llms.txt', '/sitemap.xml', '/robots.txt', '/favicon.svg', '/og-image.png']) {
  check(`${f} exists in dist`, isStatic(f))
}

console.log(failures === 0 ? '\nrouting: all checks passed' : `\nrouting: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
