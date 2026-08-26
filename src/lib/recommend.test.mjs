/**
 * The recommender, and the two-pass credit claiming underneath it.
 *
 *   node src/lib/recommend.test.mjs
 *
 * The mistakes this guards against both end the same way — a student told they
 * have finished something they have not:
 *
 *   1. Double-counting. ACCO 310 is a REQUIRED Accountancy course and it also
 *      matches "9 credits of additional ACCO courses". Counted once, or the
 *      major looks three credits closer than it is.
 *   2. Over-crediting. Passing 24 credits of FINA electives does not make an
 *      18-credit requirement 133% done.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const out = (n) => path.join(here, `.${n}.rec.tmp.mjs`)
const bundle = (src, name) => {
  execSync(
    `npx esbuild "${path.join(root, src)}" --bundle --format=esm --alias:@=./src --outfile="${out(name)}"`,
    { stdio: 'pipe', cwd: root },
  )
  return pathToFileURL(out(name)).href
}

const { computeProgress, matchesPattern } = await import(bundle('src/lib/program-progress.ts', 'prog'))
const { recommend, extractCodes } = await import(bundle('src/lib/recommend.ts', 'rec'))
for (const n of ['prog', 'rec']) fs.rmSync(out(n), { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const c = (code, title, credits = 3) => ({ code, title, credits })

// The real Accountancy major, as curated from the 2026-2027 calendar.
const accountancy = {
  id: 'bcomm-accountancy',
  parent_id: 'bcomm',
  name: 'Commerce — Accountancy',
  total_credits: 90,
  groups: [
    {
      id: 'g1', position: 10, title: 'Accountancy — required', kind: 'all', credits: 15,
      rule: null, note: null, pattern: null,
      courses: [
        c('ACCO 310', 'Financial Reporting I'), c('ACCO 320', 'Financial Reporting II'),
        c('ACCO 330', 'Cost and Management Accounting'), c('ACCO 340', 'Income Taxation in Canada'),
        c('ACCO 400', 'Accounting in Society'),
      ],
    },
    {
      id: 'g2', position: 11, title: 'Accountancy — electives', kind: 'credits', credits: 9,
      courses: [], note: null,
      rule: '9 credits chosen from additional courses offered by the Department.',
      pattern: { subject: 'ACCO' },
    },
  ],
}

console.log('\nmatchesPattern')
check('subject + level', matchesPattern('FINA 450', { subject: 'FINA', min_catalog: 400 }))
check('below the level is out', !matchesPattern('FINA 385', { subject: 'FINA', min_catalog: 400 }))
check('wrong subject is out', !matchesPattern('ACCO 450', { subject: 'FINA', min_catalog: 400 }))
check('no level bound means any', matchesPattern('ACCO 210', { subject: 'ACCO' }))
check('tolerates how students type it', matchesPattern('acco-210', { subject: 'ACCO' }))
check('nonsense is out', !matchesPattern('not a code', { subject: 'ACCO' }))

console.log('\ncomputeProgress — the double-count trap')
// Every required course passed, and nothing else. The elective bucket must be
// EMPTY: those five courses are already spoken for.
const onlyRequired = computeProgress(
  accountancy,
  ['ACCO 310', 'ACCO 320', 'ACCO 330', 'ACCO 340', 'ACCO 400'].map((x) => ({ code: x, credits: 3 })),
)
check('required group is complete', onlyRequired.groups[0].earnedCredits === 15, String(onlyRequired.groups[0].earnedCredits))
check(
  'electives claim NONE of them',
  onlyRequired.groups[1].earnedCredits === 0,
  String(onlyRequired.groups[1].earnedCredits),
)
check('so the major is 15 of 24, not 24 of 24', onlyRequired.earnedNamed === 15, String(onlyRequired.earnedNamed))

console.log('\ncomputeProgress — electives that genuinely count')
const withElectives = computeProgress(
  accountancy,
  ['ACCO 310', 'ACCO 320', 'ACCO 330', 'ACCO 340', 'ACCO 400', 'ACCO 455', 'ACCO 465'].map((x) => ({ code: x, credits: 3 })),
)
check('extra ACCO fills the bucket', withElectives.groups[1].earnedCredits === 6, String(withElectives.groups[1].earnedCredits))
check('and nothing is left unassigned', withElectives.unassignedCredits === 0, String(withElectives.unassignedCredits))

console.log('\ncomputeProgress — over-crediting')
const tooMany = computeProgress(
  accountancy,
  ['ACCO 401', 'ACCO 402', 'ACCO 403', 'ACCO 404', 'ACCO 405'].map((x) => ({ code: x, credits: 3 })),
)
check('capped at what the group asks for', tooMany.groups[1].earnedCredits === 9, String(tooMany.groups[1].earnedCredits))
check('never over 100%', tooMany.percentNamed <= 100, String(tooMany.percentNamed))

console.log('\nrecommend')
const catalog = [
  { subject: 'ACCO', catalog: '310', title: 'Financial Reporting I', credits: 3 },
  { subject: 'ACCO', catalog: '320', title: 'Financial Reporting II', credits: 3 },
  { subject: 'ACCO', catalog: '455', title: 'Advanced Auditing', credits: 3 },
  { subject: 'COMP', catalog: '352', title: 'Data Structures', credits: 3,
    prerequisites: 'Prerequisite: COMP 249 must be completed previously.' },
  { subject: 'GEOL', catalog: '208', title: 'Rocks', credits: 3 },
]
const s = recommend({ program: accountancy, taken: ['ACCO 310', 'COMP 249'], catalog })
check('never suggests what you have passed', !s.some((x) => x.code === 'ACCO 310'))
check('required comes first', s[0].reason === 'required', s[0]?.reason)
check('and names the requirement', s[0].because.includes('Accountancy — required'), s[0]?.because)
check('electives appear after required', s.findIndex((x) => x.reason === 'elective') > s.findIndex((x) => x.reason === 'required'))
check('unlocks is last and labelled a maybe', s.filter((x) => x.reason === 'unlocks').every((x) => x.unlockedBy?.length))
check('an unrelated course is not suggested at all', !s.some((x) => x.code === 'GEOL 208'))
check(
  'offered-next-term outranks not-offered within a tier',
  (() => {
    const r = recommend({ program: accountancy, taken: [], catalog, offeredCodes: ['ACCO 320'] })
    const req = r.filter((x) => x.reason === 'required')
    return req[0].code === 'ACCO 320'
  })(),
)

console.log('\nextractCodes')
check('pulls codes out of prose', extractCodes('Prerequisite: COMP 248 or COMP 249; MATH 203 previously.').join(',') === 'COMP 248,COMP 249,MATH 203')
check('and does NOT try to read the logic', !('or' in extractCodes('COMP 248 or COMP 249')))

console.log(failed === 0 ? '\nrecommend: all checks passed' : `\nrecommend: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
