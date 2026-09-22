/**
 * Mirror one whole term's sections locally, with no keys needed in Vercel.
 *
 * Same logic as api/_sync-sections.ts, but unbounded — it walks every subject
 * in one go, which the serverless version cannot do inside its timeout. Use
 * this to backfill a term; leave the cron to keep it fresh.
 *
 *   node scripts/sync-sections.mjs 2254          # Winter 2026
 *   node scripts/sync-sections.mjs 2254 --dry
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TERM = (process.argv[2] ?? '').trim()
const DRY = process.argv.includes('--dry')
if (!/^\d{4}$/.test(TERM)) {
  console.error('usage: node scripts/sync-sections.mjs <termcode> [--dry]')
  process.exit(1)
}

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
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const AUTH =
  'Basic ' +
  Buffer.from(`${env.CONCORDIA_API_USER}:${env.CONCORDIA_API_KEY}`).toString('base64')

const yes = (v) => String(v ?? '').trim().toUpperCase() === 'Y'
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '').trim()) ? String(v).trim() : null)
const text = (v) => (String(v ?? '').trim() || null)

const toRow = (r) => ({
  term_code: String(r.termCode ?? TERM),
  class_number: String(r.classNumber ?? ''),
  // Part of the key: a class with several meeting patterns repeats its
  // class number once per pattern.
  meeting_pattern_number: num(r.meetingPatternNumber) ?? 1,
  subject: String(r.subject ?? '').toUpperCase(),
  catalog: String(r.catalog ?? '').trim(),
  course_title: text(r.courseTitle),
  section: text(r.section),
  component_code: text(r.componentCode),
  component_description: text(r.componentDescription),
  session: text(r.session),
  career: text(r.career),
  enrollment_capacity: num(r.enrollmentCapacity),
  current_enrollment: num(r.currentEnrollment),
  waitlist_capacity: num(r.waitlistCapacity),
  current_waitlist: num(r.currentWaitlistTotal),
  has_seat_reserved: yes(r.hasSeatReserved),
  class_status: text(r.classStatus),
  class_start_time: text(r.classStartTime),
  class_end_time: text(r.classEndTime),
  class_start_date: date(r.classStartDate),
  class_end_date: date(r.classEndDate),
  // `modays` is Concordia's own spelling. Do not "fix" it.
  mondays: yes(r.modays),
  tuesdays: yes(r.tuesdays),
  wednesdays: yes(r.wednesdays),
  thursdays: yes(r.thursdays),
  fridays: yes(r.fridays),
  saturdays: yes(r.saturdays),
  sundays: yes(r.sundays),
  location_code: text(r.locationCode),
  building_code: text(r.buildingCode),
  room: text(r.room),
  instruction_mode_description: text(r.instructionModeDescription),
  department_description: text(r.departmentDescription),
  faculty_description: text(r.facultyDescription),
  synced_at: new Date().toISOString(),
})

// An RPC, not a select: PostgREST caps a plain query at 1000 rows and
// course_catalog holds 7,884, so the first version saw 32 subjects and
// called that a full run.
const { data: subjRows, error } = await db.rpc('catalog_subjects')
if (error) throw error
const subjects = [...new Set((subjRows ?? []).map((x) => String(x).toUpperCase()))].sort()
console.log(`term ${TERM} · ${subjects.length} subjects${DRY ? ' · DRY RUN' : ''}\n`)

let wrote = 0
let empty = 0
const failed = []
const started = Date.now()

for (const [i, subject] of subjects.entries()) {
  try {
    const res = await fetch(
      `https://opendata.concordia.ca/API/v1/course/scheduleTerm/filter/${subject}/${TERM}`,
      { headers: { Authorization: AUTH, Accept: 'application/json' }, signal: AbortSignal.timeout(40_000) },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    const rows = Array.isArray(body) ? body : []
    if (rows.length === 0) {
      empty++
    } else if (!DRY) {
      const seen = new Set()
      const mapped = rows
        .map(toRow)
        .filter((r) => r.class_number && r.subject)
        .filter((r) => {
          const k = `${r.class_number}|${r.meeting_pattern_number}`
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      for (let n = 0; n < mapped.length; n += 500) {
        const { error: e } = await db
          .from('course_sections')
          .upsert(mapped.slice(n, n + 500), { onConflict: 'term_code,class_number,meeting_pattern_number' })
        if (e) throw new Error(e.message)
      }
      wrote += mapped.length
    } else {
      wrote += rows.length
    }
    if (!DRY) {
      await db.from('section_sync_state').upsert(
        {
          subject,
          term_code: TERM,
          rows: rows.length,
          status: rows.length ? 'ok' : 'empty',
          error: null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'subject,term_code' },
      )
    }
  } catch (e) {
    failed.push({ subject, error: e.message })
  }
  const pct = (((i + 1) / subjects.length) * 100).toFixed(0)
  process.stdout.write(`\r  ${i + 1}/${subjects.length} (${pct}%)  ${wrote} sections  ${empty} empty  ${failed.length} failed   `)
}

console.log(`\n\ndone in ${Math.round((Date.now() - started) / 1000)}s`)
console.log(`  sections: ${wrote}`)
console.log(`  subjects with nothing in this term: ${empty}`)
if (failed.length) {
  console.log(`  failed (${failed.length}):`)
  for (const f of failed.slice(0, 10)) console.log(`    ${f.subject}: ${f.error}`)
}
