/**
 * Writes the Apple Team ID into the built apple-app-site-association.
 *
 *   node scripts/stamp-aasa.mjs        (runs as part of `npm run build`)
 *
 * The file in public/ carries the placeholder __APPLE_TEAM_ID__ because the
 * Team ID lives in the environment (APPLE_TEAM_ID), not in the repository. It
 * is not a secret: Apple publishes every app's association file. It is kept
 * out of the source only so the value has one home, shared with the iOS build
 * (codemagic.yaml reads the same variable).
 *
 * A build without it still succeeds, because the website does not need it,
 * but it says so loudly: universal links silently do nothing when the Team ID
 * in this file is wrong, and nothing else would ever tell you.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const FILE = 'dist/.well-known/apple-app-site-association'
if (!existsSync(FILE)) {
  console.error(`[aasa] ${FILE} is missing from the build`)
  process.exit(1)
}

const raw = readFileSync(FILE, 'utf8')
const team = (process.env.APPLE_TEAM_ID ?? '').trim()

if (!/^[A-Z0-9]{10}$/.test(team)) {
  console.warn(
    '[aasa] APPLE_TEAM_ID is not set (10 characters, e.g. AB12CD34EF). Universal links will not open the app until it is.',
  )
} else {
  writeFileSync(FILE, raw.replaceAll('__APPLE_TEAM_ID__', team))
}

// Whatever happened above, the file must still be valid JSON with the shape
// Apple reads, or iOS discards all of it.
const parsed = JSON.parse(readFileSync(FILE, 'utf8'))
const details = parsed?.applinks?.details
if (!Array.isArray(details) || !details.every((d) => Array.isArray(d.appIDs) && Array.isArray(d.components))) {
  console.error('[aasa] apple-app-site-association does not have the applinks.details shape')
  process.exit(1)
}
console.log(`[aasa] ok${team ? ` (team ${team})` : ' (placeholder team id)'}`)
