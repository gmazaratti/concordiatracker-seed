// node src/lib/coop.test.mjs — co-op thresholds and the recent-credits GPA.
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
const out = path.join(os.tmpdir(), `ct-coop-${process.pid}.mjs`)
execSync(`npx esbuild src/lib/coop.ts --bundle --platform=node --format=esm --log-level=warning "--outfile=${out}"`)
const { coopRule, recentGpa } = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })
let fail = 0
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) fail++ }

check('engineering 2.5', coopRule('Gina Cody School of Engineering and Computer Science', 'Mechanical Engineering')?.entry === 2.5)
check('jmsb entry 3.0 stay 2.7', coopRule('John Molson School of Business', 'Commerce')?.stay === 2.7)
check('arts: political science 3.3', coopRule('Faculty of Arts and Science', 'Political Science')?.entry === 3.3)
check('arts: unknown program is null', coopRule('Faculty of Arts and Science', 'Philosophy') === null)
check('no faculty is null', coopRule(null, null) === null)

const L = (credits, points, rank, extra = {}) => ({ credits, points, rank, graded: true, superseded: false, ...extra })
const r = recentGpa([L(3, 4.0, 3), L(3, 2.0, 3), L(3, 3.0, 2), L(3, 3.0, 1), L(3, 1.0, 0)], 6)
check('takes newest 6 credits', r?.credits === 6 && Math.abs(r.gpa - 3.0) < 1e-9)
const r2 = recentGpa([L(3.5, 4.0, 2), L(3, 3.0, 1), L(3, 2.0, 0)], 6)
check('whole courses, can pass the window', r2?.credits === 6.5)
check('skips ungraded and superseded', recentGpa([L(3, 4, 2, { graded: false }), L(3, 1, 1, { superseded: true }), L(3, 3, 0)])?.gpa === 3)
check('empty is null', recentGpa([]) === null)
if (fail) process.exit(1)
