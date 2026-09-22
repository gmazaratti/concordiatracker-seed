/**
 * Import the reviews Beaudelaire gave us permission to use.
 *
 * WHAT IT IMPORTS AND WHAT IT REFUSES TO.
 *
 * `db.reviews.json` holds 65,908 rows, and 65,742 of them (99.7%) carry a
 * `userId` beginning `rate_my_professor_`. Those were scraped from Rate My
 * Professor. Beaudelaire's permission covers what is HIS — the 166 reviews
 * students wrote on concordia.courses — and he cannot grant rights to RMP's
 * content on RMP's behalf. So this script imports the 166 and skips the rest.
 *
 * `--include-rmp` exists so the decision is a deliberate flag someone has to
 * type, not a default nobody noticed. Read the note it prints before using it.
 *
 * ATTENDANCE IS NEVER INFERRED. Their tags include SKIP_CLASS_YOU_WONT_PASS
 * and PARTICIPATION_MATTERS, which are impressions, not policy. Mapping those
 * to "attendance: mandatory" would put a confident wrong answer next to a
 * real one from a syllabus. Imported rows leave it null.
 *
 *   node scripts/import-cc-reviews.mjs            # dry run
 *   node scripts/import-cc-reviews.mjs --write
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const WRITE = process.argv.includes('--write')
const INCLUDE_RMP = process.argv.includes('--include-rmp')
const SRC = '.import/reviews.json'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
const svc = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const isRmp = (r) => String(r.userId ?? '').startsWith('rate_my_professor')
const when = (r) => {
  const t = r.timestamp
  const s = typeof t === 'object' && t ? t.$date : t
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
/** 1–5, or null. Their 0 means "not answered", not "zero out of five". */
const scale = (v) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}
/** "hang-xu" → "Hang Xu". Their instructor ids are slugs. */
const unslug = (s) =>
  String(s ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ') || null

const all = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const own = all.filter((r) => !isRmp(r))
const rmp = all.filter(isRmp)

console.log(`${SRC}: ${all.length} rows`)
console.log(`  written on concordia.courses : ${own.length}`)
console.log(`  scraped from Rate My Professor: ${rmp.length}  ${INCLUDE_RMP ? '(INCLUDING)' : '(skipped)'}`)
if (INCLUDE_RMP) {
  console.log(
    '\n  ⚠ --include-rmp is set. These are Rate My Professor\'s content, not\n' +
      '    Beaudelaire\'s to license. Importing them republishes a third party\'s\n' +
      '    data under our name. This is a decision, not a default.\n',
  )
}

const picked = INCLUDE_RMP ? all : own
// A review with no course and no text is not a review.
const rows = picked
  .filter((r) => r.courseId && (r.content?.trim() || scale(r.difficulty) || scale(r.experience)))
  .map((r) => ({
    course_code: String(r.courseId).toUpperCase(),
    instructor: unslug(r.instructorId),
    user_id: null,
    source: isRmp(r) ? 'ratemyprofessor' : 'concordia.courses',
    source_id: String(r._id?.$oid ?? r._id ?? ''),
    difficulty: scale(r.difficulty),
    experience: scale(r.experience),
    attendance: null, // never inferred — see the header
    body: (r.content ?? '').trim() || null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    term: null,
    created_at: when(r),
  }))
  .filter((r) => r.source_id)

console.log(`\nwill import ${rows.length} rows`)
console.log('  distinct courses    :', new Set(rows.map((r) => r.course_code)).size)
console.log('  distinct instructors:', new Set(rows.map((r) => r.instructor).filter(Boolean)).size)
console.log('  with prose          :', rows.filter((r) => r.body).length)
console.log('\nfirst row:', JSON.stringify(rows[0], null, 1))

if (!WRITE) {
  console.log('\n(dry run — pass --write to insert)')
  process.exit(0)
}

let done = 0
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500)
  const { error } = await svc
    .from('course_reviews')
    .upsert(chunk, { onConflict: 'source,source_id', ignoreDuplicates: false })
  if (error) {
    console.error('chunk failed at', i, error.message)
    process.exit(1)
  }
  done += chunk.length
  process.stdout.write(`\r  imported ${done}/${rows.length}`)
}
const { count } = await svc
  .from('course_reviews')
  .select('id', { count: 'exact', head: true })
console.log(`\ndone. course_reviews now holds ${count} rows.`)
