/**
 * Checks grade conversion, which feeds every GPA in the app.
 *
 *   node src/lib/gpa.test.mjs
 *
 * Letters exist because that is what a transcript shows. Converting them is a
 * place where a quiet mistake would inflate or deflate someone's GPA without
 * anyone noticing, so the mapping is pinned here rather than trusted.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const out = path.join(here, '.gpa.test.tmp.mjs')

// --bundle, so the relative import inside gpa.ts is inlined; --alias, so the
// "@/..." path alias resolves the same way Vite resolves it.
execSync(
  `npx esbuild --bundle "${path.join(here, 'gpa.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: root },
)
const { parseFinalGrade, letterToPercent, percentToGrade, GRADE_LETTERS, isNotation } =
  await import(pathToFileURL(out).href)

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label}` +
      (ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  )
}

console.log('\nevery letter on the scale round-trips to itself')
for (const l of GRADE_LETTERS.filter((x) => !isNotation(x))) {
  check(`${l} → percent → ${l}`, percentToGrade(letterToPercent(l)).letter, l)
}

console.log('\nnotations are one-way: they carry points but no percentage')
// FNS, R and NR are not positions on the percentage scale, so they cannot come
// back out of one. What has to hold is that they are worth 0.00 and that the
// notation itself is preserved rather than silently becoming "F".
for (const n of GRADE_LETTERS.filter(isNotation)) {
  check(`${n} is recognised as a notation`, isNotation(n), true)
  check(`${n} is worth 0 points`, percentToGrade(letterToPercent(n)).points, 0)
  check(`${n} is accepted as typed`, parseFinalGrade(n), 0)
}
check('a letter is not a notation', isNotation('B+'), false)

console.log('\nwhat a student might type')
check('a percentage', parseFinalGrade('87'), 87)
check('a percentage with a sign', parseFinalGrade('87%'), 87)
check('a lowercase letter', parseFinalGrade('a-'), 80)
check('a letter with a stray space', parseFinalGrade('B +'), 77)
check('blank means ungraded', parseFinalGrade('   '), null)
check('nonsense is ungraded, not an F', parseFinalGrade('pass'), null)
check('above 100 is rejected', parseFinalGrade('150'), null)
check('negative is rejected', parseFinalGrade('-5'), null)
check('zero is a real grade', parseFinalGrade('0'), 0)

console.log('\nthe band minimum, never a midpoint')
// Using the midpoint would hand out a grade the letter never guaranteed, and
// would quietly inflate a GPA the student did not earn.
check('A- maps to the floor of the A- band', letterToPercent('A-'), 80)
check('an A- never scores as an A', percentToGrade(letterToPercent('A-')).letter, 'A-')
check('an unknown letter is null', letterToPercent('E'), null)

fs.unlinkSync(out)
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) FAILED.`)
process.exit(failed === 0 ? 0 : 1)
