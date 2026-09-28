// Node-run checks for lib/version-gate.ts (`npm run test:version`).
import { versionGate, nativeStoreLink } from './version-gate.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}
const store = 'https://apps.apple.com/app/id6816822795'
const info = (minBuild, latestBuild, storeUrl = store) => ({ platform: 'ios', minBuild, latestBuild, storeUrl })
const kind = (a, b) => versionGate(a, b).kind

check('below minimum blocks', kind(4, info(5, 9)) === 'block')
check('at minimum, below latest: banner', kind(5, info(5, 9)) === 'soft')
check('between min and latest: banner', kind(7, info(5, 9)) === 'soft')
check('at latest: nothing', kind(9, info(5, 9)) === 'ok')
check('above latest (TestFlight ahead of the store): nothing', kind(12, info(5, 9)) === 'ok')
check('build as a string from App.getInfo', kind('4', info(5, 9)) === 'block')
check('the banner carries the latest build', versionGate(7, info(5, 9)).latest === 9)

// Fail open.
check('no response body', kind(4, null) === 'ok')
check('error body', kind(4, { error: 'x' }) === 'ok')
check('non-numeric build installed', kind('abc', info(5, 9)) === 'ok')
check('empty build installed', kind('', info(5, 9)) === 'ok')
check('fractional minimum', kind(4, info(5.5, 9)) === 'ok')
check('minimum above latest (misconfigured)', kind(4, info(10, 9)) === 'ok')
check('store URL that is not the App Store', kind(4, info(5, 9, 'https://evil.example/app')) === 'ok')
check('plain http store URL', kind(4, info(5, 9, 'http://apps.apple.com/app/id1')) === 'ok')
check('javascript: store URL', kind(4, info(5, 9, 'javascript:alert(1)')) === 'ok')

check('itms-apps link', nativeStoreLink(store) === 'itms-apps://apps.apple.com/app/id6816822795')

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nversion-gate: all passed')
