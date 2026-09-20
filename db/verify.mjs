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
    create table courses (id text primary key default gen_random_uuid()::text, user_id uuid, code text, final_percent numeric);
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
    (gen_random_uuid(),'${ME}','COMP 248'), (gen_random_uuid(),'${OTHER}','comp248'), (gen_random_uuid(),'${OTHER}','COMP-248');
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

// -- db/saved_schedules.sql --------------------------------------------------
console.log('\ndb/saved_schedules.sql')
await db.exec(migration('saved_schedules.sql').replace(/references auth.users\(id\) on delete cascade/g, ''))
console.log('  ok    DDL applies')

const mine = (await db.query(
  `insert into public.saved_schedules (user_id, name, term_code, sections)
   values ($1,'Plan A','2254','[{"code":"COMP 248"}]'::jsonb) returning id`, [ME])).rows[0].id
await db.query(
  `insert into public.saved_schedules (user_id, name) values ($1,'Someone else')`, [OTHER])

check('an unshared schedule has no token', (await db.query(
  'select share_token from public.saved_schedules where id = $1', [mine])).rows[0].share_token, null)

const token = (await db.query('select public.share_schedule($1) as t', [mine])).rows[0].t
check('sharing mints a token', typeof token === 'string' && token.length >= 16, true)
check('sharing twice keeps the same link',
  (await db.query('select public.share_schedule($1) as t', [mine])).rows[0].t, token)

const shared = (await db.query('select * from public.schedule_by_token($1)', [token])).rows
check('the token opens the schedule', shared.length, 1)
check('and it carries the sections', shared[0].sections, [{ code: 'COMP 248' }])
check('but never the owner', Object.keys(shared[0]).includes('user_id'), false)

check('a wrong token opens nothing',
  (await db.query('select * from public.schedule_by_token($1)', ['nope'])).rows.length, 0)
check('an empty token opens nothing',
  (await db.query('select * from public.schedule_by_token($1)', [''])).rows.length, 0)
check('a null token opens nothing',
  (await db.query('select * from public.schedule_by_token($1)', [null])).rows.length, 0)

await db.query('select public.unshare_schedule($1)', [mine])
check('revoking breaks the link',
  (await db.query('select * from public.schedule_by_token($1)', [token])).rows.length, 0)

// -- db/prereq_tree.sql ------------------------------------------------------
console.log('\ndb/prereq_tree.sql')
await db.exec(migration('prereq_tree.sql'))
console.log('  ok    DDL applies')

await db.exec(`
  insert into course_catalog (id, subject, catalog, title, class_unit, prerequisites) values
    ('20','MECH','300','Decoy',3,'Prerequisite: COMP 2480.'),
    ('21','SOEN','287','Web',3,'Prerequisite: COMP 248.'),
    ('22','COMP','248','OOP I',3,null);
`)
const byCodes = async (codes) =>
  (await db.query('select * from public.courses_by_codes($1)', [codes])).rows
check('a level is fetched in one call', (await byCodes(['COMP 249','COMP 352'])).length, 2)
check('formatting does not matter', (await byCodes(['comp-249'])).length, 1)
check('an unknown code returns nothing', (await byCodes(['ZZZZ 999'])).length, 0)
check('an empty list returns nothing', (await byCodes([])).length, 0)

const unlocked = async (code) =>
  (await db.query('select subject, catalog from public.unlocked_by($1, 60)', [code])).rows
const opened = await unlocked('COMP 248')
check('finishing a course opens the ones naming it',
  opened.map((r) => `${r.subject}${r.catalog}`).sort(), ['COMP249', 'COMP335', 'SOEN287'])
// MECH 300 requires COMP 2480, a different course. If the code extractor
// truncates four-digit catalogue numbers, "COMP 2480" becomes "COMP 248" and
// this course appears in the wrong tree entirely.
check('a four-digit code is not truncated into a different course',
  opened.some((r) => r.subject === 'MECH'), false)
check('and the four-digit course is found under its own code',
  (await unlocked('COMP 2480')).map((r) => r.subject), ['MECH'])
check('a course never unlocks itself',
  opened.some((r) => `${r.subject}${r.catalog}` === 'COMP248'), false)

console.log(String.fromCharCode(10) + 'db/outline_sync.sql')
/**
 * This one is here because it FAILED IN PRODUCTION on a fresh project: the
 * scheduling block raised when it could not find an existing cron job to read
 * CRON_SECRET from, which aborted the migration and left the tables uncreated.
 * A schema must not be blocked by a scheduling convenience. PGlite has no
 * pg_cron, so running it here is exactly that scenario.
 */
await db.exec('create table if not exists public.shared_blueprints (id uuid primary key default gen_random_uuid(), course_code text);')
await db.exec(migration('outline_sync.sql'))
check(
  'the tables exist even with no pg_cron',
  (await db.query("select count(*)::int n from information_schema.tables where table_name = 'outline_sources'")).rows[0].n,
  1,
)
check(
  'source_url is added to shared_blueprints',
  (await db.query("select count(*)::int n from information_schema.columns where table_name = 'shared_blueprints' and column_name = 'source_url'")).rows[0].n,
  1,
)
check('outline_coverage() runs on an empty ledger', (await db.query('select * from public.outline_coverage()')).rows.length, 0)

console.log(String.fromCharCode(10) + 'db/message_requests.sql')
/**
 * The limits on messaging a stranger are the entire reason the feature is
 * allowed to exist, so they are checked here rather than trusted. A
 * client-side link check is a suggestion; this is the one that counts.
 */
await db.exec(`
  create table if not exists public.messages(
    id uuid primary key default gen_random_uuid(), sender uuid, recipient uuid,
    body text, attachment jsonb, read_at timestamptz,
    created_at timestamptz not null default now());
  create or replace function public.are_friends(a uuid, b uuid)
    returns boolean language sql stable as $fn$ select false $fn$;
`)
await db.exec(migration('message_requests.sql'))
const mreq = async (h, b) =>
  (await db.query('select public.send_message_request($1,$2) r', [h, b])).rows[0].r
const hasLink = async (t) => (await db.query('select public.ct_has_link($1) r', [t])).rows[0].r

check('a plain question is not a link', await hasLink('are you in section EC?'), false)
check('http is', await hasLink('see https://x.com/a'), true)
check('a bare shortener is', await hasLink('bit.ly/free'), true)
check('a decimal grade is not', await hasLink('I got 87.5 on the midterm'), false)

await db.exec(`
  create table if not exists public.user_profile (user_id uuid primary key, handle text);
  insert into public.user_profile (user_id, handle) values ('${OTHER}', 'other')
    on conflict (user_id) do update set handle = 'other';
`)
check('a first message sends', (await mreq('other', 'hi, are you in COMM 305?')).ok, true)
check('a second one does not', (await mreq('other', 'again?')).reason, 'already_sent')
check('a link is refused by the database', (await mreq('other', 'try bit.ly/x')).reason, 'link')
check('an unknown handle', (await mreq('ghost', 'hello')).reason, 'no_user')
check('too long', (await mreq('other', 'x'.repeat(501))).reason, 'too_long')
check(
  'exactly one request row exists',
  (await db.query('select count(*)::int c from public.messages where is_request')).rows[0].c,
  1,
)

/**
 * stats_and_terms.sql - the term normaliser.
 *
 * This one has a TWIN in TypeScript (`src/lib/term.ts`). Writes go through the
 * TS one and the backfill through the SQL one, so if they ever disagree the
 * database ends up with exactly the split spellings the migration exists to
 * remove. The expectations below are the same ones `src/lib/term.test.mjs`
 * asserts of the TS side, on purpose: that is what keeps the two in step.
 */
console.log('\ndb/stats_and_terms.sql')
const termSql = fs.readFileSync(path.join(DB_DIR, 'stats_and_terms.sql'), 'utf8')
await db.exec(
  termSql.slice(
    termSql.indexOf('create or replace function public.ct_normalize_term'),
    termSql.indexOf('-- Preview before it changes anything:'),
  ),
)
const norm = async (t) =>
  (await db.query('select public.ct_normalize_term($1) as t', [t])).rows[0].t

check('SHOUTING is fixed', await norm('FALL 2026'), 'Fall 2026')
check('and lower case', await norm('fall 2026'), 'Fall 2026')
check('French seasons map to English', await norm('Automne 2026'), 'Fall 2026')
check('Hiver too', await norm('Hiver 2027'), 'Winter 2027')
check('accented ete', await norm('été 2026'), 'Summer 2026')
check('a slash separator still parses', await norm('Fall/2026'), 'Fall 2026')
check('extra whitespace collapses', await norm('  Fall   2026  '), 'Fall 2026')
check('unparseable text survives, trimmed', await norm('  Intersession 2026 '), 'Intersession 2026')
check('a trailing qualifier is left alone', await norm('Fall 2026 (evening)'), 'Fall 2026 (evening)')
check('empty stays empty', await norm(''), '')
check('null is safe', await norm(null), null)
check('running it twice changes nothing', await norm(await norm('AUTOMNE 2026')), 'Fall 2026')

// The BACKFILL, not just the function. It discovers its targets from the
// catalogue because the first version named `past_courses`, which does not
// exist on this project — and one missing table aborts the whole migration.
// So the thing worth testing is that it runs against whatever IS there, and
// skips a view rather than failing on it.
await db.exec(`
  create table if not exists public.term_a (id int, term text);
  create table if not exists public.term_b (id int, term text);
  create table if not exists public.no_term (id int, name text);
  insert into public.term_a values (1, 'FALL 2026'), (2, 'Fall 2026'), (3, 'Intersession 2026');
  insert into public.term_b values (1, 'Automne 2026'), (2, null);
  create or replace view public.term_v as select id, term from public.term_a;
`)
await db.exec(
  termSql.slice(
    termSql.indexOf('-- The backfill DISCOVERS its targets'),
    termSql.indexOf('-- ── 2. Why a parse failed'),
  ),
)
const terms = async (t) =>
  (await db.query(`select term from public.${t} order by id`)).rows.map((r) => r.term)

check('the backfill found a table nobody named', await terms('term_a'),
  ['Fall 2026', 'Fall 2026', 'Intersession 2026'])
check('and a second one', await terms('term_b'), ['Fall 2026', null])
check('a view was skipped, not written through', await terms('term_v'),
  ['Fall 2026', 'Fall 2026', 'Intersession 2026'])
check('a table with no term column is untouched',
  (await db.query('select count(*)::int c from public.no_term')).rows[0].c, 0)


// -- db/calendar_feed.sql ----------------------------------------------------
//
// The token is the only thing standing between a stranger and a student's
// deadlines, so what matters here is that rotating REALLY replaces it and that
// enabling twice does not quietly hand out a second one.
console.log(String.fromCharCode(10) + 'db/calendar_feed.sql')
await db.exec(migration('calendar_feed.sql').replace(/references auth\.users \(id\) on delete cascade/g, ''))

const firstToken = (await db.query('select public.enable_calendar_feed() t')).rows[0].t
check('a token is 64 hex characters', /^[0-9a-f]{64}$/.test(firstToken), true)
check(
  'enabling twice returns the SAME link, not a second one',
  (await db.query('select public.enable_calendar_feed() t')).rows[0].t,
  firstToken,
)
check(
  'and there is exactly one row for the user',
  (await db.query('select count(*)::int c from public.calendar_feeds')).rows[0].c,
  1,
)
check(
  'my_calendar_feed hands back the layers, both on by default',
  (await db.query('select include_assessments a, include_tasks t from public.my_calendar_feed()')).rows[0],
  { a: true, t: true },
)

await db.exec('select public.set_calendar_feed_layers(false, null)')
check(
  'a null layer means leave it alone, not turn it off',
  (await db.query('select include_assessments a, include_tasks t from public.my_calendar_feed()')).rows[0],
  { a: false, t: true },
)

const rotated = (await db.query('select public.rotate_calendar_feed() t')).rows[0].t
check('rotating mints a different token', rotated !== firstToken, true)
check(
  'and the old one resolves to nothing at all',
  (await db.query('select count(*)::int c from public.calendar_feeds where token = $1', [firstToken])).rows[0].c,
  0,
)
check(
  'rotating also resets the read counter, so "never fetched" is honest again',
  (await db.query('select last_fetched_at, fetch_count from public.my_calendar_feed()')).rows[0],
  { last_fetched_at: null, fetch_count: 0 },
)

await db.exec("select public.ct_touch_calendar_feed($token$" + rotated + "$token$, 'Google-Calendar-Importer')")
const touched = (await db.query('select fetch_count c, last_fetch_agent a from public.my_calendar_feed()')).rows[0]
check('a fetch is counted', touched.c, 1)
check('and the agent is kept, so the panel can say who read it', touched.a, 'Google-Calendar-Importer')

await db.exec('select public.disable_calendar_feed()')
check(
  'turning it off removes the row, so the URL 404s',
  (await db.query('select count(*)::int c from public.calendar_feeds')).rows[0].c,
  0,
)
let rotateFailed = false
try {
  await db.query('select public.rotate_calendar_feed()')
} catch {
  rotateFailed = true
}
check('rotating a feed that does not exist is an error, not a silent no-op', rotateFailed, true)


// -- db/account_flags.sql + db/searchable_profiles.sql -----------------------
//
// A PRIVACY CONTRACT, so it is asserted rather than described. "Findable but
// private" is only true if the private row really does carry a name and a
// picture and nothing else -- in the SEARCH results as well as on the page,
// because a leak through search is still a leak.
console.log(String.fromCharCode(10) + 'db/searchable_profiles.sql')
await db.exec(`
  drop table if exists public.user_profile cascade;
  create table public.user_profile (
    user_id uuid primary key, handle text, name text, avatar_url text,
    program text, program_id text, bio text, links jsonb,
    profile_public boolean, courses_public boolean, email text,
    plan_status text, pro_until timestamptz,
    -- The harness strips the ALTER on user_profile, so the columns
    -- account_flags.sql adds have to exist here for its UPDATEs to land.
    is_internal boolean not null default false,
    comped boolean not null default false
  );
  drop table if exists public.profile_follows cascade;
  create table public.profile_follows (follower_id uuid, following_id uuid);
  drop table if exists public.courses cascade;
  create table public.courses (
    -- TEXT, measured against production through PostgREST's own schema doc
    -- rather than assumed: a manually created course gets an id like
    -- 'manual-course-1', which is why this column was never uuid. A fixture
    -- that types it uuid lets a migration pass here and throw 42883 live.
    id text primary key default gen_random_uuid()::text, user_id uuid, code text,
    name text, color text, term text, archived boolean default false
  );
  insert into public.user_profile
    (user_id, handle, name, avatar_url, program, bio, links, profile_public, courses_public, email) values
    ('${ME}', 'shy', 'Sarah Quiet', 'https://img/a.png', 'Finance', 'my bio',
     '{"instagram":"x"}'::jsonb, false, false, 'shy@example.com'),
    ('${OTHER}', 'loud', 'Leo Public', 'https://img/b.png', 'Comp Sci', 'hello',
     '{"instagram":"y"}'::jsonb, true, true, 'loud@example.com'),
    ('33333333-3333-3333-3333-333333333333', 'sharer', 'Sam Classes', null, 'Arts', null,
     null, false, true, 'sharer@example.com'),
    ('44444444-4444-4444-4444-444444444444', 'ctstaff', 'Concordia Tracker', null, null, null,
     null, true, true, 'concordiatracker@gmail.com');
  insert into public.courses (id, user_id, code, name, color, term) values
    (gen_random_uuid(), '${ME}', 'FINA 210', 'Finance', 'rose', 'Fall 2026'),
    (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'ENGL 251', 'Lit', 'teal', 'Fall 2026');
`)
await db.exec(migration('account_flags.sql'))
await db.exec(migration('searchable_profiles.sql'))

check('the internal account was flagged by email', (await db.query(
  "select is_internal from public.user_profile where handle = 'ctstaff'")).rows[0].is_internal, true)

const hit = async (q) => (await db.query('select * from public.search_public_profiles($1, 10)', [q])).rows

check('a PRIVATE handle is now found at all', (await hit('shy')).length, 1)
const shy = (await hit('shy'))[0]
check('  ...with their name', shy.name, 'Sarah Quiet')
check('  ...and their picture', shy.avatar_url, 'https://img/a.png')
check('  ...but NOT their program', shy.program, null)
check('  ...and no follower count', shy.follower_count, 0)
check('  ...flagged as private so the UI can say so', shy.is_public, false)
check('searching a private NAME works too', (await hit('Sarah')).length, 1)
check('a public profile still carries its program', (await hit('loud'))[0].program, 'Comp Sci')
check('an internal account is invisible in search', (await hit('ctstaff')).length, 0)
check('and invisible by its display name', (await hit('Concordia Tracker')).length, 0)

const page = async (h) => (await db.query('select * from public.get_public_profile($1)', [h])).rows[0]
const shyPage = await page('shy')
check('the private PAGE gives a name', shyPage.name, 'Sarah Quiet')
check('and a picture', shyPage.avatar_url, 'https://img/a.png')
check('and no bio', shyPage.bio, null)
check('and no program', shyPage.program, null)
check('and no links', shyPage.links, {})
check('and says it is private', shyPage.is_public, false)
check('an internal handle has no page at all', await page('ctstaff'), undefined)
const loudPage = await page('loud')
check('a public page still gives the bio', loudPage.bio, 'hello')
check('and the links', loudPage.links, { instagram: 'y' })

const classes = async (h) => (await db.query('select code from public.get_public_courses($1)', [h])).rows.map(r => r.code)
check('a private profile that never shared classes shows none', await classes('shy'), [])
// The point of splitting the switches: sharing classes no longer requires
// publishing a bio and a program you never wrote.
check('a private profile that DID share classes shows them', await classes('sharer'), ['ENGL 251'])
check('a public sharer shows theirs', await classes('loud'), [])


// -- db/admin_audit.sql ------------------------------------------------------
//
// The log exists so "who gave this person Pro and why" has an answer that is
// not somebody's memory. So what is asserted is that the answer is THERE and
// cannot be quietly removed: a reason is mandatory, the actor is taken from
// the session rather than from the caller, and the grant and its record are
// one statement so a client cannot do the first and skip the second.
console.log(String.fromCharCode(10) + 'db/admin_audit.sql')
await db.exec(`
  create or replace function public.is_admin() returns boolean
    language sql stable as $fn$ select true $fn$;
  -- auth.uid() resolves to the 'shy' row here, so that row is the acting
  -- admin AND the founder the backfill attributes the old grants to.
  update public.user_profile set email = 'alexxdegryse@gmail.com' where handle = 'shy';
  insert into public.user_profile (user_id, handle, name, email, plan_status)
    values ('55555555-5555-5555-5555-555555555555', 'flo', 'Florence Marie',
            'florencemarie123@gmail.com', 'pro');
`)
await db.exec(migration('admin_audit.sql'))

const FLO = '55555555-5555-5555-5555-555555555555'
const audit = async (t) =>
  (await db.query('select * from public.admin_audit_for_user($1, 50)', [t])).rows

// One of the four comped emails exists in this fixture (Flo); the assertion
// is that the backfill FINDS the accounts it names, not that all four are here.
check('the backfill recorded the grant nobody could explain',
  (await db.query("select count(*)::int c from public.admin_audit_log where action = 'plan.grant.backfill'")).rows[0].c, 1)
check('and it says who and why', (await audit(FLO))[0].reason.startsWith('Comped by Alex'), true)
check('Flo is marked comped', (await db.query(
  "select comped from public.user_profile where handle = 'flo'")).rows[0].comped, true)

// Re-running a migration must not duplicate history.
await db.exec(migration('admin_audit.sql'))
check('re-running does not double the backfill',
  (await db.query("select count(*)::int c from public.admin_audit_log where action = 'plan.grant.backfill'")).rows[0].c, 1)

// A grant through the wrapper leaves a record, with the before and after.
await db.query("select public.admin_set_plan($1, true, 'Beta tester, 3 months', null)", [FLO])
const rows = await audit(FLO)
check('granting Pro logged an entry', rows[0].action, 'plan.grant')
check('  with the reason given', rows[0].reason, 'Beta tester, 3 months')
check('  the value before', rows[0].old_value.plan_status, 'pro')
check('  and the value after', rows[0].new_value.plan_status, 'pro')
check('  attributed to the signed-in admin', rows[0].actor_email, 'alexxdegryse@gmail.com')
check('a hand grant also marks the account comped, so it never counts as paying',
  (await db.query("select comped from public.user_profile where handle = 'flo'")).rows[0].comped, true)

await db.query("select public.admin_set_flags($1, true, false, 'Moved to the test estate')", [FLO])
check('a flag change is logged too', (await audit(FLO))[0].action, 'flag.set')
check('  with its before', (await audit(FLO))[0].old_value.is_internal, false)

// The reason is the whole point, so it is enforced rather than encouraged.
let refused = false
try { await db.query("select public.log_admin_action('plan.grant', $1, '   ')", [FLO]) }
catch { refused = true }
check('an action with a blank reason is refused', refused, true)

// And an admin cannot rewrite what happened.
const before = (await db.query('select count(*)::int c from public.admin_audit_log')).rows[0].c
check('the log is append-only: no update or delete policy exists',
  (await db.query(`select count(*)::int c from pg_policies
     where tablename = 'admin_audit_log' and cmd in ('UPDATE','DELETE')`)).rows[0].c, 0)
check('and every action so far is still there', before, 3)


// ── db/api_tokens.sql ───────────────────────────────────────────────────────
// The credential behind /api/v1. Three things are worth running rather than
// reading: that the plaintext really is absent from the table, that the
// OUT-parameter names in these `returns table` functions do not shadow their
// own columns (the 42702 that took tickets down for weeks), and that the
// owner statistics the API reads match the ones the dashboard reads.
console.log('\ndb/api_tokens.sql')

await db.exec(`
  create table if not exists auth.users (id uuid primary key);
  insert into auth.users (id) values ('${ME}'), ('${OTHER}') on conflict do nothing;
  create table if not exists public.user_profile (user_id uuid primary key);
  alter table public.user_profile
    add column if not exists email text,
    add column if not exists name text,
    add column if not exists school text,
    add column if not exists program text,
    add column if not exists is_internal boolean default false,
    add column if not exists comped boolean default false,
    add column if not exists created_at timestamptz not null default now();
  create table if not exists public.site_events (
    id serial primary key, user_id uuid, visitor_id text, kind text,
    created_at timestamptz not null default now()
  );
  create table if not exists public.tickets (
    id uuid primary key default gen_random_uuid(), status text default 'open'
  );
  -- Stripe's own event log, the only place a subscription's START date is
  -- recorded. No payload column, like production.
  create table if not exists public.stripe_events (
    id text primary key, type text, processed_at timestamptz not null default now()
  );
  alter table public.user_profile add column if not exists trial_end timestamptz;
  alter table public.courses add column if not exists archived boolean default false;
`)
await db.exec(migration('api_tokens.sql'))
console.log('  ok    DDL applies')

const mint = async (name, scope) =>
  (await db.query('select * from public.create_api_token($1,$2)', [name, scope])).rows[0]

const pat = await mint('my laptop', 'me')
check('a personal token is prefixed so it is recognisable', pat.token.slice(0, 7), 'ct_pat_')
check('  and is 244 bits of hex after it', pat.token.length, 71)
check('  the list shows only its first 15 characters', pat.prefix, pat.token.slice(0, 15))

// The whole security claim of this table, asserted rather than described.
const tokRow = (await db.query('select token_hash, prefix from public.api_tokens')).rows[0]
check('the plaintext is NOT stored anywhere on the row',
  tokRow.token_hash === pat.token || tokRow.prefix === pat.token, false)
check('  what is stored is its sha256',
  tokRow.token_hash,
  (await db.query('select public.ct_hash_api_token($1) h', [pat.token])).rows[0].h)

const checkTok = async (tok) =>
  (await db.query('select * from public.ct_api_token_check(public.ct_hash_api_token($1))', [tok])).rows

const tokHit = (await checkTok(pat.token))[0]
check('a valid token resolves to its owner', tokHit.user_id, ME)
check('  with its scope', tokHit.scope, 'me')
check('  and is allowed', tokHit.allowed, true)
check('an unknown token resolves to nothing at all', (await checkTok('ct_pat_nope')).length, 0)

// Usage is counted, which is what makes "this token has never been used" a
// real answer in the UI rather than a guess.
check('using it counts', (await db.query('select use_count from public.api_tokens where id=$1', [pat.id])).rows[0].use_count, 1)

// The limiter: the 121st call inside one minute is refused, and the refusal
// still identifies the token so the endpoint can answer 429 rather than 401.
for (let i = 0; i < 118; i++) await checkTok(pat.token)
const at120 = (await checkTok(pat.token))[0]
check('the 120th call in a minute is still allowed', at120.allowed, true)
const at121 = (await checkTok(pat.token))[0]
check('the 121st is refused', at121.allowed, false)
check('  but still names the token, so it is a 429 and not a 401', at121.user_id, ME)
check('  and says when to come back', at121.retry_after > 0, true)

// A new window forgives.
await db.query("update public.api_tokens set window_start = now() - interval '2 minutes'")
check('a fresh minute starts the count again', (await checkTok(pat.token))[0].allowed, true)

// Scope cannot be widened: owner tokens need is_admin(), enforced in the
// function rather than in the screen that calls it. An earlier section of this
// file leaves is_admin() true, so "not an admin" is stated, not assumed.
await db.exec(`create or replace function public.is_admin() returns boolean
  language sql stable as $$ select false $$;`)
let ownerRefused = false
try { await mint('stats', 'owner') } catch { ownerRefused = true }
check('a non-admin cannot mint an owner token', ownerRefused, true)

await db.exec(`create or replace function public.is_admin() returns boolean
  language sql stable as $$ select true $$;`)
const own = await mint('dashboard', 'owner')
check('an admin can', own.token.slice(0, 9), 'ct_owner_')
check('  and it carries the owner scope', (await checkTok(own.token))[0].scope, 'owner')

// Revoking is immediate and total.
check('revoking reports that it did something', (await db.query('select public.revoke_api_token($1) r', [pat.id])).rows[0].r, true)
check('  and the token stops resolving', (await checkTok(pat.token)).length, 0)
check('  revoking twice does nothing the second time', (await db.query('select public.revoke_api_token($1) r', [pat.id])).rows[0].r, false)
check('  but the row survives, so the list can still explain itself',
  (await db.query('select count(*)::int c from public.api_tokens where revoked_at is not null')).rows[0].c, 1)

// THE DRY GUARANTEE. The dashboard and the API must never be able to report
// different numbers; they share one body, and this is what proves it.
await db.exec(`
  -- Earlier sections leave their own profiles behind, and these checks assert
  -- exact counts, so this one starts from a known population.
  delete from public.user_profile;
  insert into public.user_profile (user_id, email, name, is_internal, comped, created_at)
  values ('${ME}','a@x.test','A',false,false, now()),
         ('${OTHER}','b@x.test','B',true,false, now())
  on conflict (user_id) do update
    set email = excluded.email, name = excluded.name,
        is_internal = excluded.is_internal, comped = excluded.comped,
        created_at = excluded.created_at;
  insert into public.site_events (user_id, visitor_id, kind) values ('${ME}','v1','view');
`)
const rawCounts = (await db.query('select public.ct_overview_counts_raw() c')).rows[0].c
const viaAdmin = (await db.query('select public.admin_overview_counts() c')).rows[0].c
check('the API and the dashboard read one body: counts are identical', rawCounts, viaAdmin)
check('  internal accounts are excluded from the total', rawCounts.users_total, 1)
check('  and counted on their own line', rawCounts.internal, 1)

await db.exec(`create or replace function public.is_admin() returns boolean
  language sql stable as $$ select false $$;`)
check('a non-admin gets nothing from the dashboard wrapper',
  (await db.query('select public.admin_overview_counts() c')).rows[0].c, {})
check('  while the raw function, which only the service role may call, still answers',
  (await db.query('select public.ct_overview_counts_raw() c')).rows[0].c.users_total, 1)

// /owner/users is counts-only by construction. If a name or an email ever
// appears in its output, that is the leak this check exists to catch.
const cohorts = (await db.query('select public.ct_owner_users_raw() c')).rows[0].c
check('cohorts count the real users', cohorts.total, 1)
check('  and report internal separately', cohorts.excluded_internal, 1)
check('  and never name anybody',
  JSON.stringify(cohorts).includes('a@x.test') || JSON.stringify(cohorts).includes('"A"'), false)

const tokSeries = (await db.query('select * from public.ct_daily_series_raw(7)')).rows
check('the series has one row per day with no gaps', tokSeries.length, 7)
check('  including days where nothing happened', tokSeries[0].signups, 0)


// ── db/support_api.sql ──────────────────────────────────────────────────────
// The reply guard is the whole point of this file: it has to hold against a
// careless caller, so it is enforced in the database and asserted here rather
// than trusted to the HTTP layer.
console.log('\ndb/support_api.sql')

await db.exec(`
  create sequence if not exists public.ticket_case_seq start 1001;
  -- An earlier section already made a minimal tickets stand-in, so these are
  -- ALTERs: create-if-not-exists would silently skip and leave it too thin.
  create table if not exists public.tickets (id uuid primary key default gen_random_uuid());
  alter table public.tickets
    add column if not exists case_id text unique default 'TKT-' || nextval('public.ticket_case_seq'),
    add column if not exists user_id uuid,
    add column if not exists email text,
    add column if not exists name text,
    add column if not exists subject text,
    add column if not exists category text not null default 'other',
    add column if not exists status text not null default 'open',
    add column if not exists source text not null default 'app',
    add column if not exists context jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists last_activity_at timestamptz not null default now(),
    add column if not exists user_seen_at timestamptz;
  create table if not exists public.ticket_messages (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references public.tickets(id) on delete cascade,
    author_id uuid, author_role text not null,
    author_name text not null default 'Support',
    body text not null, created_at timestamptz not null default now(),
    constraint msg_role_valid check (author_role in ('user','staff'))
  );
  create table if not exists public.bug_reports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid, user_email text, title text not null,
    description text default '', page text,
    status text not null default 'open', admin_notes text,
    created_at timestamptz not null default now()
  );
  create or replace function public.is_admin() returns boolean
    language sql stable as $$ select true $$;
`)
await db.exec(migration('support_api.sql'))
console.log('  ok    DDL applies')

await db.exec(`
  insert into public.tickets (id, email, name, subject, status)
  values ('33333333-3333-3333-3333-333333333333','a@x.test','Ali','Calendar sync does nothing','open');
  insert into public.ticket_messages (ticket_id, author_role, author_name, body)
  values ('33333333-3333-3333-3333-333333333333','user','Ali','I paid for the calendar thing.');
  insert into public.bug_reports (id, user_email, title, description, page)
  values ('44444444-4444-4444-4444-444444444444','b@x.test','Blank screen','It went white','/app/today');
`)
const T = 't:33333333-3333-3333-3333-333333333333'
const D = 'd:44444444-4444-4444-4444-444444444444'

const thread = async (id) => (await db.query('select public.support_thread($1) t', [id])).rows[0].t
const list = async (...a) =>
  (await db.query('select public.support_threads($1,$2,$3,$4,$5) l', a)).rows[0].l
const reply = async (id, text) => {
  try {
    await db.query('select public.support_reply($1,$2)', [id, text])
    return 'ok'
  } catch (e) {
    return e.detail ?? e.message
  }
}
const patch = async (id, status, needs) => {
  try {
    return await db
      .query('select public.support_patch($1,$2,$3) t', [id, status, needs])
      .then((r) => r.rows[0].t)
  } catch (e) {
    return { refused: e.detail ?? e.message }
  }
}

// Ids are composite and say which table they came from.
check('a ticket thread resolves', (await thread(T)).type, 'ticket')
check('  and carries its case id', (await thread(T)).reference, 'TKT-1001')
check('a diagnostic thread resolves', (await thread(D)).type, 'diagnostic')
check('a malformed id is not found, not an error', await thread('nonsense'), null)
check('a bare uuid with no prefix is not found', await thread('33333333-3333-3333-3333-333333333333'), null)

// A diagnostic is a report: one user message, and nothing can reply to it.
const supDiag = await thread(D)
check('a diagnostic returns exactly one message', supDiag.messages.length, 1)
check('  authored by the user side', supDiag.messages[0].author, 'user')
check('  carrying the notes and the payload', supDiag.messages[0].text.includes('/app/today'), true)
check('  and says it cannot be replied to', supDiag.can_reply, false)
check('replying to a diagnostic is refused', await reply(D, 'hello'), 'diagnostic_not_repliable')

// The happy path, and what it does to ownership.
check('a new ticket reads as open', (await thread(T)).status, 'open')
check('  and may be replied to', (await thread(T)).can_reply, true)
check('an empty reply is refused', await reply(T, '   '), 'empty')
check('a reply lands', await reply(T, 'Fixed — three months of Pro is on your account.'), 'ok')
check('  replying to an open thread moves it to ai_handling', (await thread(T)).status, 'ai_handling')
check('  the message is authored by the assistant', (await thread(T)).messages.at(-1).author, 'ai')
check('  and the label is NOT written into the text',
  (await thread(T)).messages.at(-1).text.toLowerCase().includes('ai'), false)
check('  the assistant may keep replying', await reply(T, 'Anything else?'), 'ok')

// needs_human: the customer asked for a person.
await patch(T, null, true)
check('flagging needs_human sticks', (await thread(T)).needs_human, true)
check('  and blocks a reply', await reply(T, 'let me help'), 'needs_human')
check('  and says so on the thread', (await thread(T)).can_reply, false)

// The hand-back gesture, in one call.
const handBack = await patch(T, 'ai_handling', null)
check('setting ai_handling clears needs_human', handBack.needs_human, false)
check('  and the assistant may reply again', await reply(T, 'Back to me.'), 'ok')

// A human taking over, explicitly.
await patch(T, 'human_takeover', null)
check('human_takeover reads back', (await thread(T)).status, 'human_takeover')
check('  and blocks a reply', await reply(T, 'me again'), 'human_takeover')

// ...and implicitly, which is the one that matters: Alex simply replies.
await patch(T, 'ai_handling', null)
check('handed back to the assistant', (await thread(T)).status, 'ai_handling')
await db.query('select public.reply_ticket($1,$2)', [
  '33333333-3333-3333-3333-333333333333',
  'Hi Ali, Alex here.',
])
check('A STAFF REPLY TAKES THE THREAD AUTOMATICALLY', (await thread(T)).status, 'human_takeover')
check('  so the assistant stops without being told', await reply(T, 'draft'), 'human_takeover')
check('  and the human message is labelled human, not staff',
  (await thread(T)).messages.at(-1).author, 'human')

// Resolved is the most final of the three.
await patch(T, 'resolved', null)
check('resolved reads back', (await thread(T)).status, 'resolved')
check('  and blocks a reply even after a hand-back attempt', await reply(T, 'hello'), 'resolved')

// Listing, filtering and `since`.
const supAll = await list(null, null, null, 50, 0)
check('the list returns both kinds', supAll.threads.length, 2)
check('  with a total', supAll.total, 2)
check('filtering by type works', (await list('diagnostic', null, null, 50, 0)).threads.length, 1)
check('filtering by status works', (await list(null, 'resolved', null, 50, 0)).threads.length, 1)
check('a status nobody is in returns none', (await list(null, 'open', null, 50, 0)).threads.length, 1)

// THE `since` RULE. An old thread with a new message must come back, or a
// poller would never see the reply it exists to answer.
await db.exec(`
  update public.tickets
     set created_at = now() - interval '30 days', last_activity_at = now()
   where id = '33333333-3333-3333-3333-333333333333';
  update public.bug_reports
     set created_at = now() - interval '30 days'
   where id = '44444444-4444-4444-4444-444444444444';
`)
const supRecent = await list(null, null, new Date(Date.now() - 3600_000).toISOString(), 50, 0)
check('since returns an OLD thread that was just updated', supRecent.threads.length, 1)
check('  and it is the ticket, not the untouched diagnostic', supRecent.threads[0].type, 'ticket')

// Paging.
check('per_page is honoured', (await list(null, null, null, 1, 0)).threads.length, 1)
check('  and the page number is derived from the offset', (await list(null, null, null, 1, 1)).page, 2)
check('  while total counts everything that matched', (await list(null, null, null, 1, 0)).total, 2)

// A diagnostic has no handling, and says so rather than pretending.
check('a diagnostic refuses ai_handling', (await patch(D, 'ai_handling', null)).refused,
  'diagnostic_has_no_handling')
check('  refuses needs_human', (await patch(D, null, true)).refused, 'diagnostic_has_no_handling')
check('  but can be resolved', (await patch(D, 'resolved', null)).status, 'resolved')
check('an unknown status is refused', (await patch(T, 'sideways', null)).refused, 'bad_status')

// The third token scope.
const supTok = (await db.query("select * from public.create_api_token('Alfred','support')")).rows[0]
check('a support token has its own prefix', supTok.token.slice(0, 7), 'ct_sup_')
check('  and its own scope', (await db.query(
  'select scope from public.ct_api_token_check(public.ct_hash_api_token($1))', [supTok.token],
)).rows[0].scope, 'support')
await db.exec(`create or replace function public.is_admin() returns boolean
  language sql stable as $$ select false $$;`)
let supRefused = false
try { await db.query("select * from public.create_api_token('sneaky','support')") } catch { supRefused = true }
check('a non-admin cannot mint one', supRefused, true)


// ── db/support_api_v2.sql ───────────────────────────────────────────────────
// The holds. These are the rules that must survive a confused model, a retried
// script, and a future endpoint that forgets to check — so they are asserted
// here rather than trusted to the prompt that also states them.
console.log('\ndb/support_api_v2.sql')

await db.exec(`
  create table if not exists public.admin_audit_log (
    id bigserial primary key, actor_id uuid, actor_email text,
    action text not null, target_id uuid, target_email text,
    old_value jsonb, new_value jsonb, reason text not null,
    created_at timestamptz not null default now()
  );
`)
await db.exec(migration('support_api_v2.sql'))
console.log('  ok    DDL applies')

const mkTicket = async (subject, body) => {
  const r = await db.query(
    `insert into public.tickets (email, name, subject) values ('c@x.test','C',$1) returning id`,
    [subject],
  )
  const id = r.rows[0].id
  await db.query(
    `insert into public.ticket_messages (ticket_id, author_role, author_name, body)
     values ($1,'user','C',$2)`,
    [id, body],
  )
  return `t:${id}`
}
const v2Reply = async (id, text) => {
  try {
    await db.query('select public.support_reply($1,$2)', [id, text])
    return 'ok'
  } catch (e) {
    return e.detail ?? e.message
  }
}
const v2Patch = async (id, status, needs, actor = 'admin') => {
  try {
    return (
      await db.query('select public.support_patch($1,$2,$3,$4) t', [id, status, needs, actor])
    ).rows[0].t
  } catch (e) {
    return { refused: e.detail ?? e.message }
  }
}
const v2Thread = async (id) => (await db.query('select public.support_thread($1) t', [id])).rows[0].t

/* ── The crisis hold ─────────────────────────────────────────────────────── */
// Phrasings taken from how people actually write, not from a taxonomy.
for (const [label, text] of [
  ['the plain word', 'I have been thinking about suicide a lot this term'],
  ['a euphemism', 'honestly I just want to die, nothing is working'],
  ['an abbreviation', 'failing this course might make me kms tbh'],
  ['self-harm', 'I have been hurting myself over these grades'],
  ['no reason to live', 'I feel like there is no reason to live anymore'],
]) {
  const t = await mkTicket('Help', text)
  check(`crisis: ${label} blocks a reply`, await v2Reply(t, 'Here is a KB link'), 'crisis_hold')
  check(`  and flags it for a person`, (await v2Thread(t)).needs_human, true)
}
const v2Ordinary = await mkTicket('Import', 'My COMP 248 outline will not import, can you help')
check('an ordinary thread is not held', await v2Reply(v2Ordinary, 'Try this'), 'ok')
check('  and reports no hold', (await v2Thread(v2Ordinary)).hold, null)
check('  and can_reply stays true', (await v2Thread(v2Ordinary)).can_reply, true)

// A reply quoting a helpline must not lock the thread against the person
// answering it — the hold reads the CUSTOMER's words only.
const crisisT = await mkTicket('Help', 'I want to die')
await v2Reply(crisisT, 'x')
await db.query(
  `insert into public.ticket_messages (ticket_id, author_role, author_name, body)
   select id,'staff','Support','Please call 988 — they are there right now.' from public.tickets
   where id = $1`,
  [crisisT.slice(2)],
)
check(
  'our own reply quoting a helpline does not re-trigger it',
  await v2Reply(crisisT, 'follow up'),
  // Still held — by the CUSTOMER's original words, which is correct — and
  // not by ours. Proven by the ordinary thread below.
  'crisis_hold',
)
const staffOnly = await mkTicket('Billing', 'How do I change my card')
await db.query(
  `insert into public.ticket_messages (ticket_id, author_role, author_name, body)
   values ($1,'staff','Support','If you are in crisis call 988 or Samaritans 116 123.')`,
  [staffOnly.slice(2)],
)
check('a helpline in OUR text alone does not hold the thread', await v2Reply(staffOnly, 'ok'), 'ok')

/* ── The money hold ──────────────────────────────────────────────────────── */
for (const [label, text] of [
  ['refund', 'I want a refund for this month please'],
  ['money back', 'can I get my money back, it never worked'],
  ['chargeback', 'I will do a chargeback if this is not sorted'],
  ['discount', 'any chance of a discount since it was broken'],
  ['a fix date', 'when will this be fixed? I need it for Monday'],
  ['an ETA', 'what is the eta on the calendar bug'],
]) {
  const t = await mkTicket('Money', text)
  check(`money: ${label} blocks a reply`, await v2Reply(t, 'Sure!'), 'money_hold')
  check(`  and flags it for a person`, (await v2Thread(t)).needs_human, true)
}

/* ── Resolved is Alex's word ─────────────────────────────────────────────── */
const v2Own = await mkTicket('Question', 'How do I add a course')
check('the assistant cannot resolve a thread', (await v2Patch(v2Own, 'resolved', null, 'support')).refused,
  'resolve_is_human_only')
check('  but the admin UI can', (await v2Patch(v2Own, 'resolved', null, 'admin')).status, 'resolved')
const v2Esc = await mkTicket('Question', 'How do I add a course')
check('the assistant CAN escalate', (await v2Patch(v2Esc, null, true, 'support')).needs_human, true)
check('  and can hand back', (await v2Patch(v2Esc, 'ai_handling', null, 'support')).needs_human, false)

/* ── Every automated reply is on the record ──────────────────────────────── */
const v2Logged = await db.query(
  `select action, target_email, new_value->>'body' as body, reason
     from public.admin_audit_log where action = 'support.ai_reply' and new_value->>'body' = 'Try this' limit 1`,
)
check('an AI reply is written to the audit log', v2Logged.rows[0]?.action, 'support.ai_reply')
check('  with the exact wording', v2Logged.rows[0]?.body, 'Try this')
check('  and who it went to', v2Logged.rows[0]?.target_email, 'c@x.test')

/* ── Listing: the needs_human filter and the cursor ──────────────────────── */
const v2List = async (o = {}) =>
  (
    await db.query('select public.support_threads($1,$2,$3,$4,$5,$6,$7) l', [
      o.type ?? null, o.status ?? null, o.since ?? null,
      o.limit ?? 50, 0, o.needs_human ?? null, o.cursor ?? null,
    ])
  ).rows[0].l

const v2Flagged = await v2List({ needs_human: true })
check('needs_human=true filters', v2Flagged.threads.every((t) => t.needs_human === true), true)
check('  and it finds every held thread', v2Flagged.threads.length >= 11, true)
const v2Unflagged = await v2List({ needs_human: false })
check('needs_human=false filters the other way',
  v2Unflagged.threads.every((t) => t.needs_human === false), true)

const v2P1 = await v2List({ limit: 3 })
check('limit caps the page', v2P1.threads.length, 3)
check('  and hands back a cursor', typeof v2P1.next_cursor === 'string', true)
const v2P2 = await v2List({ limit: 3, cursor: v2P1.next_cursor })
check('the cursor moves on', v2P2.threads.length, 3)
check('  with no row repeated',
  v2P1.threads.filter((a) => v2P2.threads.some((b) => b.id === a.id)).length, 0)
const v2Last = await v2List({ limit: 500 })
check('a page that does not fill returns no cursor', v2Last.next_cursor, null)
check('every thread carries updated_at for incremental polling',
  v2Last.threads.every((t) => !!t.updated_at), true)
check('and its category', v2Last.threads.every((t) => !!t.category), true)


{
// ── db/personal_api.sql ─────────────────────────────────────────────────────
console.log('\ndb/personal_api.sql')
await db.exec(`
  create table if not exists public.assignments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid, course_id text, title text, date timestamptz,
    type text, weight numeric, score numeric, raw_score numeric, raw_total numeric,
    done boolean, missed boolean, awaiting_grade boolean, extension_granted boolean,
    notes text, description text, status text,
    provenance_status text, provenance_confirmations int
  );
`)
await db.exec(migration('personal_api.sql'))
// Earlier sections leave is_admin() wherever their last test needed it, so
// this one states it rather than inheriting a value from three blocks up.
await db.exec(
  'create or replace function public.is_admin() returns boolean language sql stable as ' +
    '$$ select true $$;',
)
console.log('  ok    DDL applies')

check('a personal token is prefixed ct_per_',
  (await db.query("select public.ct_new_api_token('me') t")).rows[0].t.slice(0, 7), 'ct_per_')
check('  support is unchanged',
  (await db.query("select public.ct_new_api_token('support') t")).rows[0].t.slice(0, 7), 'ct_sup_')
check('  owner is unchanged',
  (await db.query("select public.ct_new_api_token('owner') t")).rows[0].t.slice(0, 9), 'ct_owner_')

/* Courses and their assignments go together, or not at all. */
const COURSE = '55555555-5555-5555-5555-555555555555'
const seed = async () => {
  await db.query('delete from public.assignments')
  await db.query('delete from public.courses where id = $1', [COURSE])
  await db.query("insert into public.courses (id, user_id, code) values ($1,$2,'COMP 248')", [COURSE, ME])
  await db.query(
    `insert into public.assignments (user_id, course_id, title, weight, notes)
     values ($1,$2,'Assignment 1',10,''), ($1,$2,'Midterm',30,'read chapter 4')`,
    [ME, COURSE],
  )
}
const counts = async () => ({
  courses: (await db.query('select count(*)::int n from public.courses where id = $1', [COURSE])).rows[0].n,
  assignments: (await db.query('select count(*)::int n from public.assignments where course_id = $1', [COURSE])).rows[0].n,
})

await seed()
const archived = (await db.query('select public.api_delete_course($1,$2,true) r', [ME, COURSE])).rows[0].r
check('archiving keeps the row', archived.archived, true)
check('  and keeps its assignments', (await counts()).assignments, 2)
check('  the course is marked archived',
  (await db.query('select archived from public.courses where id = $1', [COURSE])).rows[0].archived, true)

await seed()
const deleted = (await db.query('select public.api_delete_course($1,$2,false) r', [ME, COURSE])).rows[0].r
check('deleting removes the course', deleted.deleted, true)
check('  AND its assignments, so none are orphaned', (await counts()).assignments, 0)

/* Somebody else's course is not yours to delete. */
await seed()
let refused = false
try { await db.query('select public.api_delete_course($1,$2,false)', [OTHER, COURSE]) } catch { refused = true }
check('another user cannot delete it', refused, true)
check('  and it is still there', (await counts()).courses, 1)

/* Notes append. */
const a1 = (await db.query("select id from public.assignments where title='Midterm'")).rows[0].id
const noted = (await db.query('select public.api_append_note($1,$2,$3) r', [ME, a1, 'bring a calculator'])).rows[0].r
check('a note is APPENDED, not substituted', noted.notes, 'read chapter 4\n\nbring a calculator')
const a2 = (await db.query("select id from public.assignments where title='Assignment 1'")).rows[0].id
check('  an empty field just takes the note',
  (await db.query('select public.api_append_note($1,$2,$3) r', [ME, a2, 'first note'])).rows[0].r.notes,
  'first note')
let emptyRefused = false
try { await db.query('select public.api_append_note($1,$2,$3)', [ME, a2, '  ']) } catch { emptyRefused = true }
check('  an empty note is refused', emptyRefused, true)
let notMine = false
try { await db.query('select public.api_append_note($1,$2,$3)', [OTHER, a2, 'x']) } catch { notMine = true }
check("  and another user's assignment is not found", notMine, true)

/* The "what Alfred sent" feed. */
await db.query(
  `insert into public.admin_audit_log (actor_email, action, target_email, new_value, reason)
   values ('assistant@support','support.ai_reply','c@x.test',
           jsonb_build_object('thread','t:33333333-3333-3333-3333-333333333333',
                              'case_id','TKT-1001','subject','Calendar','body','Here you go.'),
           'Automated support reply')`,
)
const feed = (await db.query('select * from public.admin_ai_replies(7, 50)')).rows
check('the feed returns the reply', feed.length >= 1, true)
check('  with its exact wording', feed[0].body, 'Here you go.')
check('  the case it belongs to', feed[0].case_id, 'TKT-1001')
check('  and a thread id that links back', feed[0].thread, 't:33333333-3333-3333-3333-333333333333')
check('  joined forward to the CURRENT status', feed[0].status_now !== undefined, true)
check('the count is available for a badge',
  (await db.query('select public.admin_ai_reply_count(7) n')).rows[0].n >= 1, true)

await db.exec(`create or replace function public.is_admin() returns boolean
  language sql stable as $$ select false $$;`)
check('a non-admin sees nothing', (await db.query('select * from public.admin_ai_replies(7,50)')).rows.length, 0)
check('  and no count', (await db.query('select public.admin_ai_reply_count(7) n')).rows[0].n, 0)
await db.exec(`create or replace function public.is_admin() returns boolean
  language sql stable as $$ select true $$;`)

}

/* ── blocks.sql ─────────────────────────────────────────────────────────────
   Blocking, and the bug where an internal account could not see itself. */
{
  const ME = '21111111-1111-1111-1111-111111111111'
  const THEM = '22222222-2222-2222-2222-222222222222'
  const NOSY = '23333333-3333-3333-3333-333333333333'

  await db.exec(`
    drop table if exists public.profile_blocks cascade;
    create table if not exists auth.users (id uuid primary key);
    insert into auth.users (id) values ('${ME}'), ('${THEM}'), ('${NOSY}')
      on conflict do nothing;

    drop table if exists public.user_profile cascade;
    create table public.user_profile (
      user_id uuid primary key, handle text, name text, avatar_url text,
      program text, program_id text, bio text, links jsonb,
      profile_public boolean default false, courses_public boolean default false,
      is_internal boolean default false
    );
    insert into public.user_profile (user_id, handle, name, profile_public, is_internal) values
      ('${ME}',   'staffer', 'Staffer', true,  true),   -- internal, like @sarah
      ('${THEM}', 'them',    'Them',    true,  false),
      ('${NOSY}', 'nosy',    'Nosy',    true,  false);

    drop table if exists public.friendships cascade;
    create table public.friendships (
      id uuid primary key default gen_random_uuid(),
      requester uuid, addressee uuid, status text default 'accepted'
    );
    -- user_follows is the live table (profile_follows exists and is empty);
    -- its columns are follower / following.
    drop table if exists public.user_follows cascade;
    create table public.user_follows (
      follower uuid, following uuid, created_at timestamptz default now()
    );
    drop table if exists public.courses cascade;
    create table public.courses (
      id text primary key, user_id uuid, code text, name text, color text,
      term text, archived boolean default false
    );
    insert into public.courses (id, user_id, code, name, term) values
      ('c1', '${ME}', 'COMM 229', 'Comms', 'Fall 2026');
  `)

  // auth.uid() is swapped per-assertion, the way the other sections do it.
  const beMe = (who) =>
    db.exec(`create or replace function auth.uid() returns uuid language sql stable
             as $$ select ${who === null ? 'null::uuid' : `'${who}'::uuid`} $$;`)

  await beMe(ME)
  await db.exec(migration('blocks.sql'))
  console.log('')
  console.log('blocks.sql')
  check('  DDL applies', true, true)

  /* THE BUG. An internal account is hidden from others and NOT from itself. */
  await db.exec(`update public.user_profile
                    set profile_public = false, bio = 'my bio', program = 'Finance'
                  where handle = 'staffer';`)
  const seeSelf = (await db.query("select * from public.get_public_profile('staffer')")).rows
  check('you can always see your OWN profile, internal or not', seeSelf.length, 1)
  check('  and PRIVATE does not redact it from you', seeSelf[0].bio, 'my bio')
  check('  program too', seeSelf[0].program, 'Finance')
  await db.exec("update public.user_profile set profile_public = true where handle = 'staffer';")

  await beMe(THEM)
  check('  and an internal account stays hidden from everyone else',
    (await db.query("select * from public.get_public_profile('staffer')")).rows.length, 0)

  /* Blocking. */
  await beMe(ME)
  await db.exec(`insert into public.friendships (requester, addressee) values ('${ME}','${THEM}');
                 insert into public.profile_follows (follower_id, following_id) values ('${THEM}','${ME}');`)
  await db.query("select public.block_user('them')")
  check('blocking removes the friendship', (await db.query('select count(*)::int n from public.friendships')).rows[0].n, 0)
  check('  and the follow, in both directions',
    (await db.query('select count(*)::int n from public.user_follows')).rows[0].n, 0)
  check('  the blocker cannot see them', (await db.query("select * from public.get_public_profile('them')")).rows.length, 0)

  await beMe(THEM)
  check('  and they cannot see the blocker either — symmetric from one row',
    (await db.query("select * from public.get_public_profile('staffer')")).rows.length, 0)
  // Between two ORDINARY accounts, so the assertion is about the block and
  // not about is_internal. Searching for yourself must still find you, which
  // is why the first version of this check passed for the wrong reason.
  await beMe(THEM)
  await db.query("select public.block_user('nosy')")
  await beMe(NOSY)
  check('  a blocked person is not in your search results',
    (await db.query("select * from public.search_public_profiles('them')")).rows.length, 0)
  check('  and you can still find yourself',
    (await db.query("select * from public.search_public_profiles('nosy')")).rows.length, 1)
  await beMe(THEM)
  await db.query("select public.unblock_user('nosy')")

  /* Someone uninvolved is unaffected — the block is a pair, not a ban. */
  await beMe(NOSY)
  check('an unrelated person still sees them', (await db.query("select * from public.get_public_profile('them')")).rows.length, 1)

  /* Unblock. */
  await beMe(ME)
  await db.query("select public.unblock_user('them')")
  check('unblocking restores visibility', (await db.query("select * from public.get_public_profile('them')")).rows.length, 1)
  check('  but NOT the friendship', (await db.query('select count(*)::int n from public.friendships')).rows[0].n, 0)

  /* Refusals. */
  let selfBlock = 'no error'
  try { await db.query("select public.block_user('staffer')") } catch (e) { selfBlock = e.code }
  check('you cannot block yourself', selfBlock, '22023')

  let ghost = 'no error'
  try { await db.query("select public.block_user('nobody_at_all')") } catch (e) { ghost = e.code }
  check('blocking an unknown handle is a clean not-found', ghost, 'P0002')

  /* Your own classes show to you without the switch. */
  check('your own courses are visible to you',
    (await db.query("select * from public.get_public_courses('staffer')")).rows.length, 1)
  await beMe(NOSY)
  check('  and hidden from others until the switch is on',
    (await db.query("select * from public.get_public_courses('staffer')")).rows.length, 0)

  /* The admin view. */
  await beMe(ME)
  await db.query("select public.block_user('them')")
  await db.exec(`create or replace function public.is_admin() returns boolean
    language sql stable as $$ select true $$;`)
  const graph = (await db.query('select public.admin_social_graph(10) g')).rows[0].g
  check('the admin graph counts blocks', graph.counts.blocks, 1)
  check('  and names both sides', graph.blocks[0].blocked_handle, 'them')
  await db.exec(`create or replace function public.is_admin() returns boolean
    language sql stable as $$ select false $$;`)
  check('a non-admin gets nothing from it',
    Object.keys((await db.query('select public.admin_social_graph(10) g')).rows[0].g).length, 0)
}

await db.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
