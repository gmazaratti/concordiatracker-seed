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
  '/e/ev-techfair',
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
check('/openapi.json → the spec handler', resolve('/openapi.json') === '/api/openapi')
check('/.well-known/openapi.json → the spec handler', resolve('/.well-known/openapi.json') === '/api/openapi')

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
]
for (const r of notFound) {
  const dest = resolve(r)
  check(`${r} → 404`, dest === '/api/not-found', dest ?? '(no match)')
}

console.log('\nMarkdown negotiation')
for (const [r, expected] of [
  ['/', '/index.md'],
  ['/docs/introduction', '/docs/introduction/index.md'],
  ['/about', '/about/index.md'],
]) {
  const dest = resolve(r, { markdown: true })
  check(`Accept: text/markdown ${r} → ${expected}`, dest === expected, dest ?? '(no match)')
  check(`${expected} exists`, isStatic(expected))
}

console.log('\nStatic assets are served by the filesystem, not the rules')
for (const f of ['/llms.txt', '/sitemap.xml', '/robots.txt', '/favicon.svg', '/og-image.png']) {
  check(`${f} exists in dist`, isStatic(f))
}

console.log(failures === 0 ? '\nrouting: all checks passed' : `\nrouting: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
