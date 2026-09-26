/**
 * node src/lib/route-shape.test.mjs
 *
 * What leaves the browser for analytics (ours and Vercel's) must never carry a
 * token. These are the real URL shapes the app produces.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.route-shape.test.tmp.mjs')
execSync(`npx esbuild "${path.join(here, 'route-shape.ts')}" --format=esm --outfile="${out}"`, { stdio: 'pipe' })
const { scrubAnalyticsUrl, normalizePath } = await import(pathToFileURL(out).href)

let failures = 0
const check = (name, got, want) => {
  const ok = got === want
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  (got ${got}, want ${want})`}`)
  if (!ok) failures++
}
const S = 'https://concordiatracker.com'
const TOKEN = 'c76199deb7c341a9bde7cfa87ccc8cb8d2367645'
check('club claim link', scrubAnalyticsUrl(`${S}/join/${TOKEN}`), `${S}/join/:token`)
check('organizer join link', scrubAnalyticsUrl(`${S}/organizer/join/${TOKEN}`), `${S}/organizer/join/:token`)
check('teacher invite link', scrubAnalyticsUrl(`${S}/teacher/invite/oiv_74b26d5315c44827aa4f`), `${S}/teacher/invite/:token`)
check('query token dropped', scrubAnalyticsUrl(`${S}/docs/support-status?case=TKT-1001&token=${TOKEN}`), `${S}/docs/support-status`)
check('hash token dropped', scrubAnalyticsUrl(`${S}/reset-password#access_token=abc.def.ghi&type=recovery`), `${S}/reset-password`)
check('utm dropped', scrubAnalyticsUrl(`${S}/?utm_source=ig&email=a@b.c`), `${S}/`)
check('event uuid', scrubAnalyticsUrl(`${S}/e/7a7a7a7a-0000-0000-0000-00000000d001`), `${S}/e/:id`)
check('course id kept as route shape', scrubAnalyticsUrl(`${S}/app/courses/comp248`), `${S}/app/courses/comp248`)
check('long opaque id', scrubAnalyticsUrl(`${S}/s/${TOKEN}`), `${S}/s/:id`)
check('garbage is reduced to root', scrubAnalyticsUrl('not a url'), '/')
check('normalizePath untouched for plain routes', normalizePath('/app/planner'), '/app/planner')
console.log(failures ? `\n${failures} failed` : '\nall route-shape checks passed')
process.exit(failures ? 1 : 0)
