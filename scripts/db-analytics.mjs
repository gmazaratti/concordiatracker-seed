// npm run db:analytics — runs db/product_analytics.sql plus its scenario test in
// ONE transaction that is rolled back, and prints each check. Needs the
// Supabase CLI linked to the project. Not part of `npm test` (it needs the network).
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
const tmp = '.db-analytics.run.sql'
writeFileSync(tmp, ['begin;', readFileSync('db/product_analytics.sql', 'utf8'), readFileSync('db/product_analytics.test.sql', 'utf8'), 'rollback;'].join('\n'))
try {
  const out = execSync(`npx supabase db query -f ${tmp} --linked`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  for (const r of JSON.parse(out).rows) console.log(`- ${r.step}: ${r.result}`)
} finally {
  rmSync(tmp, { force: true })
}
