/**
 * Term normalisation, because production already holds the damage.
 *
 *   node src/lib/term.test.mjs
 *
 * Real values found in `courses` on 15 Sep 2026: "Summer 2026" AND
 * "SUMMER 2026", "Fall 2026" AND "FALL 2026", plus "Automne 2026" from a
 * French outline. Term is compared by string equality in the Courses tabs,
 * sortTermsDesc, and the GPA buckets, so each variant silently became its own
 * term.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const tmp = path.join(here, '.term.test.tmp.mjs')
execSync(
  `npx esbuild "${path.join(here, 'term.ts')}" --format=esm --loader:.ts=ts --outfile="${tmp}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { normalizeTerm, termRank, sortTermsDesc } = await import(pathToFileURL(tmp).href)
fs.rmSync(tmp, { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else { failed++; console.error(`  FAIL  ${name}${detail ? ` - ${detail}` : ''}`) }
}

console.log('normalizeTerm')
check('already canonical is untouched', normalizeTerm('Fall 2026') === 'Fall 2026')
check('SHOUTING is fixed', normalizeTerm('FALL 2026') === 'Fall 2026', normalizeTerm('FALL 2026'))
check('and lower case', normalizeTerm('summer 2026') === 'Summer 2026')
check('French seasons map to English', normalizeTerm('Automne 2026') === 'Fall 2026', normalizeTerm('Automne 2026'))
check('Hiver too', normalizeTerm('hiver 2027') === 'Winter 2027')
check('extra whitespace collapses', normalizeTerm('  Fall   2026 ') === 'Fall 2026')
check('a slash separator still parses', normalizeTerm('Fall/2026') === 'Fall 2026')
// The rule that keeps this safe: never replace what we cannot parse.
check('unparseable text survives, trimmed', normalizeTerm('  Intersession B  ') === 'Intersession B')
check('empty stays empty', normalizeTerm('') === '')
check('null is safe', normalizeTerm(null) === '')

console.log('')
console.log('and the damage it prevents')
// Before the fix these were three different terms in every group-by.
const variants = ['Fall 2026', 'FALL 2026', 'Automne 2026'].map(normalizeTerm)
check('three spellings collapse to one', new Set(variants).size === 1)
check('and it sorts with the others', sortTermsDesc(['Winter 2026', normalizeTerm('FALL 2026')])[0] === 'Fall 2026',
  JSON.stringify(sortTermsDesc(['Winter 2026', normalizeTerm('FALL 2026')])))
check('termRank can read it', termRank(normalizeTerm('AUTOMNE 2026')) === termRank('Fall 2026'))

const NL = String.fromCharCode(10)
console.log(failed === 0 ? NL + 'term: all checks passed' : NL + `term: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
