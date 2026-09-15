/**
 * node src/lib/signup-throttle.test.mjs
 *
 * The thing being protected is someone else's inbox, so the cases that matter
 * are the ones where the same address is tried again. The clock is a parameter
 * throughout, which is what makes any of this checkable.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.signup-throttle.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'signup-throttle.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { checkSignup, prune, waitLabel, PER_EMAIL_MS, PER_BROWSER_LIMIT } = await import(
  pathToFileURL(out).href
)

let failures = 0
const check = (label, ok, detail) => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `\n         ${detail}`}`)
}
const eq = (label, a, b) =>
  check(label, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)

const T = 1_700_000_000_000
const MIN = 60_000

console.log('checkSignup')
check('a first attempt is allowed', checkSignup([], 'a@x.com', T).ok)

const justTried = [{ email: 'a@x.com', at: T - MIN }]
const v = checkSignup(justTried, 'a@x.com', T)
check('the same address a minute later is refused', !v.ok)
eq('and it says which rule stopped it', v.reason, 'email')
check('with a wait in the right ballpark', v.retryAfterMs > 13 * MIN && v.retryAfterMs <= 14 * MIN, String(v.retryAfterMs))
check('case and spacing do not dodge it', !checkSignup(justTried, '  A@X.com ', T).ok)
check('a DIFFERENT address is still fine', checkSignup(justTried, 'b@x.com', T).ok)
check('and the same one after the window', checkSignup(justTried, 'a@x.com', T + PER_EMAIL_MS).ok)

console.log('\nthe per-browser cap')
const three = [
  { email: 'a@x.com', at: T - 50 * MIN },
  { email: 'b@x.com', at: T - 40 * MIN },
  { email: 'c@x.com', at: T - 30 * MIN },
]
const capped = checkSignup(three, 'd@x.com', T)
check(`a fourth address inside the hour is refused (limit ${PER_BROWSER_LIMIT})`, !capped.ok)
eq('for the browser reason, not the email one', capped.reason, 'browser')
check(
  'and it clears when the oldest falls out of the window',
  checkSignup(three, 'd@x.com', T + 11 * MIN).ok,
)
check('two is still fine', checkSignup(three.slice(0, 2), 'd@x.com', T).ok)

console.log('\nprune')
eq('old attempts are dropped', prune([{ email: 'a@x.com', at: T - 5 * 60 * MIN }], T).length, 0)
eq('recent ones are kept', prune([{ email: 'a@x.com', at: T - MIN }], T).length, 1)
eq('an empty list is empty', prune([], T).length, 0)

console.log('\nwaitLabel')
eq('minutes read as minutes', waitLabel(12 * MIN), '12 minutes')
eq('a part-minute rounds up', waitLabel(90_000), '2 minutes')
eq('under a minute reads in seconds', waitLabel(30_000), '30 seconds')
eq('and never says "0 seconds"', waitLabel(100), '5 seconds')

console.log(failures === 0 ? '\nsignup-throttle: all checks passed' : `\nsignup-throttle: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
