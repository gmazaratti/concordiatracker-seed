/**
 * Stamp the service worker with the build it belongs to.
 *
 * THE BUG THIS FIXES: `sw.js` was byte-identical on every deploy, because
 * VERSION was a hand-bumped constant nobody remembered to bump. A browser only
 * installs a new service worker when the script CHANGES, so:
 *
 *   deploy → sw.js identical → no new worker → no controllerchange → no reload
 *
 * In a normal tab that does not matter: navigations are NetworkFirst, so the
 * next page load fetches fresh HTML pointing at the new bundle. But an INSTALLED
 * PWA that is never fully closed makes no navigations at all — React Router
 * handles everything client-side — so the document loaded days ago, and the
 * hashed bundle it references, run forever. The comment in sw.js claiming "no
 * stuck on old version trap" was true for tabs and false for the installed app.
 *
 * Stamping it with the main bundle's content hash means every real build
 * produces a different sw.js, which is exactly the signal the browser wants. A
 * rebuild that changes nothing produces the same hash and correctly does
 * nothing.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const html = await readFile(path.join(dist, 'index.html'), 'utf8')
// Vite already content-hashes the entry bundle, so its filename IS the build id.
const entry = /assets\/index-([A-Za-z0-9_-]+)\.js/.exec(html)
if (!entry) {
  console.error('[sw] could not find the hashed entry bundle in dist/index.html')
  process.exit(1)
}

const swPath = path.join(dist, 'sw.js')
const sw = await readFile(swPath, 'utf8')
const stamped = sw.replace(/const VERSION = '[^']*'/, `const VERSION = 'ct-${entry[1]}'`)

if (stamped === sw) {
  console.error('[sw] VERSION line not found — the stamp did not apply')
  process.exit(1)
}

await writeFile(swPath, stamped)
console.log(`[sw] version → ct-${entry[1]}`)
