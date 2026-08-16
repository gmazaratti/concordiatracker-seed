/**
 * Run the migrations that contain real logic against a real Postgres.
 *
 *   npm run db:verify
 *
 * This exists because a migration shipped with `x = any ((select arr from t))`,
 * which Postgres parses as the SUBQUERY form of ANY and fails with
 * "operator does not exist: text = text[]". It was only caught in production,
 * by a person, reading an error message. A migration is code; it should be
 * possible to run it before asking someone else to.
 *
 * PGlite is Postgres compiled to WASM, so this is not a simulation — the DDL
 * and the queries below execute in an actual Postgres. It is deliberately NOT
 * a replica of the live database: tables are minimal stand-ins, and GRANT /
 * REVOKE lines are stripped because Supabase's roles do not exist here. That
 * means it verifies LOGIC, not permissions. RLS and grants still need review by
 * eye.
 */
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DB_DIR = path.dirname(fileURLToPath(import.meta.url))
const ME = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'

let failures = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `\n         expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`)
}

/**
 * Load a migration, minus the statements that need Supabase's own objects.
 *
 * Removal happens per STATEMENT, not per line. A line filter looks simpler and
 * is wrong: `alter table public.user_profile\n  add column ...;` spans two
 * lines, and dropping only the line that matched leaves the other half behind
 * to blow up the whole file. It also cannot tell that ALTER apart from the one
 * on seat_watches, which we do want.
 */
function migration(name) {
  const sql = fs.readFileSync(path.join(DB_DIR, name), 'utf8')
  // user_profile is Supabase's, and auth.users does not exist here.
  const withoutProfile = sql.replace(/alter table public\.user_profile[\s\S]*?;/gi, '')
  return withoutProfile
    .split('\n')
    .filter(
      (l) =>
        !/^\s*(grant|revoke)\b/i.test(l) &&
        !/^\s*from public, anon, authenticated;/i.test(l) &&
        !/comment on column/i.test(l) &&
        !/^\s*'Frozen final grade/i.test(l),
    )
    .join('\n')
}

async function fixtures(db) {
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select '${ME}'::uuid;
    $$;
    create table course_catalog (
      id text primary key, subject text not null, catalog text not null,
      title text not null, career text, class_unit numeric,
      prerequisites text, crosslisted text, synced_at timestamptz default now()
    );
    create table shared_blueprints (
      id serial primary key, course_code text, course_name text, professor text,
      section text, term text, verified boolean default false
    );
    create table courses (id text primary key, user_id uuid, code text, final_percent numeric);
    create table seat_watches (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null, class_number text not null, term_code text not null,
      subject text not null, catalog text not null, section text not null,
      course_title text, last_enrollment int, last_capacity int,
      last_waitlist_total int, last_waitlist_cap int,
      has_reserved boolean not null default false,
      notified_at timestamptz, checked_at timestamptz,
      created_at timestamptz not null default now(),
      unique (user_id, class_number, term_code)
    );
  `)
}

const db = new PGlite()
await fixtures(db)

// ── db/seat_alerts_and_tracking.sql ─────────────────────────────────────────
console.log('\ndb/seat_alerts_and_tracking.sql')
await db.exec(migration('seat_alerts_and_tracking.sql'))
console.log('  ok    DDL applies')

await db.exec(`
  insert into seat_watches (user_id, class_number, term_code, subject, catalog, section,
                            last_enrollment, last_capacity, checked_at)
  values ('${ME}','1234','2254','COMP','248','BB', 60, 60, now());
`)
const alerts = async () => (await db.query('select id from public.my_seat_alerts()')).rows
const poll = (enrolled, capacity) =>
  db.query('select * from public.record_seat_state($1,$2,$3,$4,$5,$6,$7)', [
    '2254', '1234', enrolled, capacity, 0, 10, false,
  ])

check('full and never alerted stays silent', (await alerts()).length, 0)
await poll(59, 60)
check('a seat opening raises one alert', (await alerts()).length, 1)
const first = (await alerts())[0].id
await db.query('select public.ack_seat_alert($1)', [first])
check('dismissing clears it', (await alerts()).length, 0)
await poll(59, 60)
check('still open on the next poll does not nag', (await alerts()).length, 0)
await poll(60, 60)
await poll(58, 60)
check('refilling then reopening alerts again', (await alerts()).length, 1)
await db.exec(`
  insert into seat_watches (user_id, class_number, term_code, subject, catalog, section,
                            last_enrollment, last_capacity, notified_at, checked_at)
  values ('${OTHER}','9999','2254','SOEN','287','AA', 1, 40, now(), now());
`)
check("another user's alert never leaks", (await alerts()).length, 1)

await db.exec(`
  insert into courses (id, user_id, code) values
    ('a','${ME}','COMP 248'), ('b','${OTHER}','comp248'), ('c','${OTHER}','COMP-248');
`)
const tracking = (await db.query('select * from public.course_tracking($1)', ['COMP248'])).rows[0]
check('tracking counts distinct users, not rows', tracking.tracked_by, 2)
check('tracking normalises code formatting', tracking.watching, 1)

await db.exec(`
  insert into course_catalog (id, subject, catalog, title, class_unit) values
    ('1','COMP','248','Object-Oriented Programming I',3),
    ('3','SOEN','287','Web Programming',3);
  insert into shared_blueprints (course_code, professor, section, verified) values
    ('COMP 248','Hanna','BB',true), ('comp248','Someone','BC',false);
`)
const enriched = async (q) =>
  (await db.query('select * from public.search_courses_enriched($1, 10)', [q])).rows
check('search finds a course with a space', (await enriched('comp 248')).length, 1)
check('search finds it without a space', (await enriched('COMP248')).length, 1)
check('blueprints are counted across code formats', (await enriched('comp 248'))[0].blueprint_count, 2)
check('a teacher-verified outline is flagged', (await enriched('comp 248'))[0].has_verified, true)
check('a miss returns nothing', (await enriched('zzzz')).length, 0)

// ── db/academic_profile.sql ─────────────────────────────────────────────────
console.log('\ndb/academic_profile.sql')
await db.exec(migration('academic_profile.sql'))
console.log('  ok    DDL applies')

const codes = async (t) => (await db.query('select public.prereq_codes($1) as c', [t])).rows[0].c
check('codes are pulled out of prose', await codes('Prerequisite: COMP 248; MATH 203 or MATH 201.'), [
  'COMP248', 'MATH201', 'MATH203',
])
check('prose with no course named yields none', await codes('Written permission of the Department.'), [])
check('null is safe', await codes(null), [])

await db.exec(`
  insert into course_catalog (id, subject, catalog, title, class_unit, prerequisites) values
    ('10','COMP','249','OOP II',3,'Prerequisite: COMP 248.'),
    ('11','COMP','352','Data Structures',3,'Prerequisite: COMP 249; MATH 203 or MATH 201.'),
    ('12','COMP','335','Theoretical CS',3,'Prerequisite: COMP 232; COMP 248.'),
    ('13','COMP','999','Special Topics',3,'Written permission of the Department.');
`)
const progress = async (completed, subjects) =>
  (await db.query('select * from public.prereq_progress($1,$2,200)', [completed, subjects])).rows

const p = await progress(['COMP 248', 'MATH 203'], ['COMP'])
check(
  'closest first, already-taken and unparseable excluded',
  p.map((r) => `${r.subject}${r.catalog}:${r.missing.join('+') || 'ready'}`),
  ['COMP249:ready', 'COMP335:COMP232', 'COMP352:COMP249+MATH201'],
)
check('no subjects returns nothing', (await progress(['COMP 248'], [])).length, 0)
check('nulls do not error', (await db.query('select count(*)::int n from public.prereq_progress(null,null,null)')).rows[0].n, 0)

await db.exec(`
  insert into shared_blueprints (course_code, professor, section, verified) values
    ('COMP 248','A. Hanna','BB',false),
    -- Same person, same section, but the code and the case are written three
    -- different ways. These must collapse into one row with three reports.
    ('COMP 248','R. Tremblay','bd',false),
    ('comp248','R. Tremblay','BD',false),
    ('COMP-248','R. Tremblay','BD',false),
    ('COMP 248','', 'BE', false);
`)
const inst = (await db.query('select * from public.section_instructors($1)', ['comp-248'])).rows
check('a verified instructor ranks first', [inst[0].section, inst[0].verified], ['BB', true])
check('a blank instructor is skipped', inst.some((r) => r.section === 'BE'), false)
check(
  'one person in one section merges across code and case',
  inst.find((r) => r.section === 'BD' && r.professor === 'R. Tremblay')?.reports,
  3,
)
check(
  'the same section with two named instructors stays two rows',
  inst.filter((r) => r.section === 'BB').length,
  2,
)

// -- db/course_browse.sql ----------------------------------------------------
console.log('\ndb/course_browse.sql')
await db.exec(migration('course_browse.sql'))
console.log('  ok    DDL applies')

const browse = async (subjects, offset, limit) =>
  (await db.query('select * from public.browse_courses($1,$2,$3)', [subjects, offset, limit])).rows

const all = await browse(null, 0, 100)
check('null subjects means no filter', all.length > 3, true)
check('every row carries a total so Load more can stop', all[0].total_count != null, true)
check('an empty array also means no filter', (await browse([], 0, 100)).length, all.length)
check('a subject filter narrows it', (await browse(['SOEN'], 0, 100)).every((r) => r.subject === 'SOEN'), true)

const page1 = await browse(['COMP'], 0, 2)
const page2 = await browse(['COMP'], 2, 2)
check('a page is the size asked for', page1.length, 2)
check('paging never repeats a row', page1.some((a) => page2.some((b) => b.id === a.id)), false)
check('the total counts everything, not the page', Number(page1[0].total_count) > 2, true)
check('past the end returns nothing', (await browse(['COMP'], 500, 10)).length, 0)

const subs = (await db.query('select * from public.my_subjects()')).rows
check('my_subjects reads only the caller own codes', subs.map((r) => r.subject).sort(), ['COMP'])

// -- db/saved_courses.sql ----------------------------------------------------
console.log('\ndb/saved_courses.sql')
await db.exec(migration('saved_courses.sql').replace(/references auth.users\(id\) on delete cascade/g, ''))
console.log('  ok    DDL applies')
await db.query('insert into public.saved_courses (user_id, code, title) values ($1,$2,$3)', [ME, 'COMP 352', 'Data Structures'])
check('a course can be saved', (await db.query('select count(*)::int n from public.saved_courses')).rows[0].n, 1)
let dup = null
try {
  await db.query('insert into public.saved_courses (user_id, code) values ($1,$2)', [ME, 'COMP 352'])
} catch (e) { dup = e.code }
check('saving the same course twice is rejected', dup, '23505')
await db.query('insert into public.saved_courses (user_id, code) values ($1,$2)', [OTHER, 'COMP 352'])
check('but two students can save the same course', (await db.query('select count(*)::int n from public.saved_courses')).rows[0].n, 2)

await db.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
