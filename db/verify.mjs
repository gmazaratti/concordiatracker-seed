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
    id text primary key, user_id uuid, code text, name text, color text,
    term text, archived boolean default false
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
    ('c1', '${ME}', 'FINA 210', 'Finance', 'rose', 'Fall 2026'),
    ('c2', '33333333-3333-3333-3333-333333333333', 'ENGL 251', 'Lit', 'teal', 'Fall 2026');
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


await db.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
