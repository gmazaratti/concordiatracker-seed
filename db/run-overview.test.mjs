/**
 * node db/run-overview.test.mjs
 *
 * Execute db/admin_overview.sql in a real Postgres and CALL every function it
 * defines.
 *
 * WHY THIS EXISTS. That one file was handed over broken twice: once for a
 * column that does not exist (`courses.created_at`) and once for an unnamed
 * union column (`order by at`). Neither is visible by reading — the first
 * needs the schema, the second needs the planner. Both die instantly here.
 *
 * The fixtures are minimal stand-ins, so this checks that the SQL is VALID
 * and returns the right shape, not that production data looks a certain way.
 */
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const db = new PGlite()
await db.exec(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;
  create or replace function public.is_admin() returns boolean language sql stable as $$ select true $$;
  create table public.user_profile (user_id uuid primary key, name text, email text, program text,
    created_at timestamptz default now(), is_internal boolean default false, comped boolean default false,
    plan_status text, pro_until timestamptz, trial_end timestamptz);
  create table public.site_events (id bigserial, visitor_id text, user_id uuid, kind text, path text,
    referrer_host text, utm_source text, device text, session_id text, created_at timestamptz default now());
  create table public.courses (id text primary key, user_id uuid, code text, archived boolean default false);
  -- The webhook's ledger. id + type + processed_at and NO payload, exactly as
  -- production has it: that missing payload is why the daily series can count
  -- subscriptions STARTED but not trials started.
  create table public.stripe_events (id text primary key, type text,
    processed_at timestamptz default now());
  create table public.tickets (id uuid default gen_random_uuid(), user_id uuid, name text, email text,
    subject text, status text, created_at timestamptz default now());
  create table public.parse_events (id uuid default gen_random_uuid(), user_id uuid, success boolean,
    error text, created_at timestamptz default now());
  create table public.bug_reports (id uuid default gen_random_uuid(), user_email text, title text,
    description text, created_at timestamptz default now());
  create table public.admin_audit_log (id bigserial, actor_email text, action text, reason text,
    target_id uuid, created_at timestamptz default now());
  insert into public.user_profile (user_id, name, email, program) values
    ('11111111-1111-1111-1111-111111111111','Real Student','a@example.com','Finance'),
    ('22222222-2222-2222-2222-222222222222','Insider','b@example.com','CS');
  update public.user_profile set is_internal = true where email = 'b@example.com';
  insert into public.site_events (visitor_id, user_id, kind, path, device, session_id)
    values ('v1','11111111-1111-1111-1111-111111111111','view','/app','desktop','s1');
  insert into public.tickets (user_id, name, email, subject, status)
    values ('11111111-1111-1111-1111-111111111111','Real','a@example.com','Calendar sync','open');
  insert into public.parse_events (user_id, success) values ('11111111-1111-1111-1111-111111111111', true);
  insert into public.bug_reports (user_email, title) values ('a@example.com','Chart is squashed');
  insert into public.admin_audit_log (actor_email, action, reason) values ('alex@x','plan.grant','Beta tester');
`)
const sql = fs.readFileSync('db/admin_overview.sql','utf8')
  .split('\n').filter(l => !/^\s*(grant|revoke)\b/i.test(l)).join('\n')
await db.exec(sql)
const series = await db.query('select * from public.admin_daily_series(7)')
console.log('admin_daily_series(7) ->', series.rows.length, 'rows; last:', JSON.stringify(series.rows.at(-1)))
const counts = await db.query('select public.admin_overview_counts() c')
console.log('admin_overview_counts ->', JSON.stringify(counts.rows[0].c))
const act = await db.query('select * from public.admin_recent_activity(10)')
console.log('admin_recent_activity ->', act.rows.length, 'rows')
for (const r of act.rows) console.log('   ', r.kind, '|', r.label, '|', r.who)
// Shape assertions, so a future edit that silently drops a branch is caught.
let bad = 0
function need(label, ok) {
  if (!ok) bad++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`)
}
need('the series has one row per day, gaps included', series.rows.length === 7)

// The two subscription columns COUNT, rather than merely parsing. Seeded
// after the first read so the before/after difference is the assertion:
// a column hard-wired to 0 would pass a "the query runs" check forever.
await db.exec(`
  insert into public.stripe_events (id, type, processed_at) values
    ('evt_a', 'customer.subscription.created', now()),
    ('evt_b', 'customer.subscription.created', now()),
    -- Not a start, so it must NOT be counted.
    ('evt_c', 'invoice.paid', now());
  update public.user_profile set trial_end = now() where is_internal = false;
`)
const after = await db.query('select * from public.admin_daily_series(7)')
const today = after.rows.at(-1)
need('subscribers counts subscriptions started that day', today.subscribers === 2)
need('  and ignores an event that is not a subscription start', today.subscribers !== 3)
need('trials counts the trials ending that day', today.trials >= 1)
need('yesterday stays zero rather than inheriting today', after.rows.at(-2).subscribers === 0)
need('internal accounts are excluded from the counts', counts.rows[0].c.users_total === 1)
need('every activity branch returns rows', new Set(act.rows.map((r) => r.kind)).size === 5)
need('activity is newest first', act.rows.every((r, i, a) => i === 0 || a[i - 1].at >= r.at))

await db.close()
console.log(bad === 0 ? '\nadmin_overview.sql: runs clean' : `\nadmin_overview.sql: ${bad} FAILED`)
process.exit(bad === 0 ? 0 : 1)
