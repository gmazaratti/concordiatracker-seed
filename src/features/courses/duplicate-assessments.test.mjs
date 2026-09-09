/**
 * Duplicate detection for a second outline import.
 *
 *   node src/features/courses/duplicate-assessments.test.mjs
 *
 * The failure this guards is silent and expensive in both directions: miss a
 * duplicate and the grade breakdown adds to 200%, call one falsely and a real
 * second midterm is dropped because it shared a name with the first.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..', '..')
const out = path.join(here, '.dupes.tmp.mjs')
execSync(
  `npx esbuild "${path.join(root, 'src/features/courses/duplicate-assessments.ts')}" --bundle --format=esm --alias:@=./src --outfile="${out}"`,
  { stdio: 'pipe', cwd: root },
)
const { findDuplicate, matchAll, normalizeTitle } = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const day = (d) => new Date(2026, 9, d, 23, 59).toISOString()
const have = [
  { id: 'a1', title: 'Assignment 1', kind: 'assignment', weight: 10, due: day(3) },
  { id: 'm1', title: 'Midterm', kind: 'midterm', weight: 30, due: day(20) },
  { id: 'q1', title: 'Quiz 1', kind: 'quiz', weight: 8, due: day(6) },
  { id: 'q2', title: 'Quiz 2', kind: 'quiz', weight: 8, due: day(13) },
]

console.log('\ntitles')
{
  check('normalizes punctuation and case', normalizeTitle('Assignment #1') === 'assignment 1')
  check('strips accents', normalizeTitle('Évaluation') === 'evaluation')
}

console.log('\nfinding a duplicate')
{
  const d = findDuplicate(
    { title: 'assignment #1', kind: 'assignment', weight: 10, due: day(3) },
    have,
  )
  check('matches a renamed-but-same title', d?.id === 'a1', String(d?.id))
  check('and is confident about it', d?.confident === true)
}
{
  // The reposted-syllabus case: the title changed, everything else did not.
  const d = findDuplicate({ title: 'Term test', kind: 'midterm', weight: 30, due: day(20) }, have)
  check('matches on date + weight + type', d?.id === 'm1', String(d?.id))
  check('and is confident', d?.confident === true)
}
{
  const d = findDuplicate({ title: 'Midterm exam', kind: 'midterm', weight: 25, due: day(20) }, have)
  check('a weight change is a weaker match', d?.id === 'm1' && d?.confident === false)
}

console.log('\nthings that are NOT duplicates')
{
  // Five quizzes at 8% each must not collapse into one another.
  const d = findDuplicate({ title: 'Quiz 3', kind: 'quiz', weight: 8, due: day(27) }, have)
  check('a new quiz with the same weight is not a duplicate', d === null, JSON.stringify(d))
}
{
  const d = findDuplicate({ title: 'Final exam', kind: 'final', weight: 40, due: null }, have)
  check('an undated item matches nothing', d === null)
}
{
  const d = findDuplicate({ title: 'Assignment 2', kind: 'assignment', weight: 10, due: day(17) }, have)
  check('a genuinely new assignment is kept', d === null)
}
{
  const d = findDuplicate({ title: 'Midterm', kind: 'midterm', weight: 30, due: day(20) }, [])
  check('nothing existing means nothing duplicated', d === null)
}

console.log('\nwhole outlines')
{
  const reposted = [
    { title: 'Assignment 1', kind: 'assignment', weight: 10, due: day(3) },
    { title: 'Quiz 1', kind: 'quiz', weight: 8, due: day(6) },
    { title: 'Quiz 2', kind: 'quiz', weight: 8, due: day(13) },
    { title: 'Midterm', kind: 'midterm', weight: 30, due: day(20) },
    { title: 'Final exam', kind: 'final', weight: 44, due: null },
  ]
  const matched = matchAll(reposted, have)
  check(
    're-importing the same outline flags the four it already has',
    matched.filter(Boolean).length === 4,
    String(matched.filter(Boolean).length),
  )
  check('and leaves the genuinely new final alone', matched[4] === null)
  check('all four are confident', matched.slice(0, 4).every((m) => m.confident))
}

console.log(
  failed === 0
    ? '\nduplicate-assessments: all checks passed'
    : `\nduplicate-assessments: ${failed} FAILED`,
)
process.exit(failed === 0 ? 0 : 1)
