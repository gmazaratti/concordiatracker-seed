/**
 * Run the real syllabus extraction (api/_parse-route.ts: Haiku, Sonnet, Gemini)
 * on one PDF, locally, and print which model answered, its token counts (from
 * the [parse] log line) and the extracted result.
 *
 *   ANTHROPIC_API_KEY=... GEMINI_API_KEY=... npm run parse:test -- path/to/outline.pdf
 *
 * Keys come from the environment or .env.local and are never printed. The API
 * code imports with `.js` specifiers that Node cannot map to `.ts`, so it is
 * bundled with esbuild into a temp file first (the repo's usual shim).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execSync } from 'node:child_process'

const file = process.argv[2]
if (!file) {
  console.error('usage: npm run parse:test -- path/to/outline.pdf')
  process.exit(1)
}
for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = /^(ANTHROPIC_API_KEY|GEMINI_API_KEY)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const out = path.join(os.tmpdir(), `ct-parse-route-${process.pid}.mjs`)
execSync(`npx esbuild api/_parse-route.ts --bundle --platform=node --format=esm --log-level=warning "--outfile=${out}"`, { stdio: 'inherit' })
const { extractOutline } = await import(pathToFileURL(out).href)
const buf = fs.readFileSync(file)
const t0 = Date.now()
const r = await extractOutline(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'application/pdf', 50_000)
fs.rmSync(out, { force: true })
console.log(
  JSON.stringify(
    { ok: r.ok, path: r.how, failure: r.failure, ms: Date.now() - t0, course: r.course, assessments: r.assessments, warnings: r.warnings },
    null,
    2,
  ),
)
