/**
 * node src/lib/oauth-identity.test.mjs
 *
 * Apple sends a name ONCE, on the very first sign-in, and never again — so
 * every case below is about surviving its absence without inventing anything.
 * The one that matters most: a Hide My Email address must not become somebody's
 * display name.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.oauth-identity.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'oauth-identity.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { displayNameFrom, isRelayEmail } = await import(pathToFileURL(out).href)

let failures = 0
function check(label, ok, detail) {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `\n         ${detail}`}`)
}
const eq = (label, actual, expected) =>
  check(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)

console.log('isRelayEmail')
check('a Hide My Email address', isRelayEmail('k7m2xq9ptr@privaterelay.appleid.com'))
check('case does not matter', isRelayEmail('K7M2@PrivateRelay.AppleID.com'))
check('a real Apple ID is not a relay', !isRelayEmail('alex@icloud.com'))
check('nor is a lookalike host', !isRelayEmail('x@privaterelay.appleid.com.evil.net'))
check('null is safe', !isRelayEmail(null))

console.log('\ndisplayNameFrom')
eq('Google sends full_name', displayNameFrom({ full_name: 'Alex Degryse' }, 'a@gmail.com'), 'Alex Degryse')
eq('some providers send name', displayNameFrom({ name: 'Alex Degryse' }, 'a@gmail.com'), 'Alex Degryse')
eq(
  "Apple's split shape, on the one sign-in that carries it",
  displayNameFrom({ given_name: 'Alex', family_name: 'Degryse' }, 'a@icloud.com'),
  'Alex Degryse',
)
eq('a first name alone is still a name', displayNameFrom({ given_name: 'Alex' }, 'a@icloud.com'), 'Alex')
eq(
  'NO NAME + a real address falls back to the local part',
  displayNameFrom({}, 'alex.degryse@gmail.com'),
  'alex.degryse',
)
eq(
  'NO NAME + Hide My Email never becomes the random local part',
  displayNameFrom({}, 'k7m2xq9ptr@privaterelay.appleid.com'),
  'Student',
)
eq('no metadata at all', displayNameFrom(undefined, undefined), 'Student')
eq('no email at all', displayNameFrom({}, null), 'Student')
eq('a blank name is not a name', displayNameFrom({ full_name: '   ' }, 'alex@gmail.com'), 'alex')
eq('whitespace is trimmed off a real one', displayNameFrom({ full_name: '  Alex  ' }, null), 'Alex')
eq(
  'a blank given_name does not produce a leading space',
  displayNameFrom({ given_name: '', family_name: 'Degryse' }, null),
  'Degryse',
)

console.log(failures === 0 ? '\noauth-identity: all checks passed' : `\noauth-identity: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
