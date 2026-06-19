-- ============================================================================
-- GATE 3 — strip test / seed / junk data.  *** DESTRUCTIVE — deletes rows. ***
-- Run on the PRODUCTION project (qagtygymiivnyfwrtmzl).
--
-- Two parts:
--   PART A (PREVIEW) — SELECTs only, deletes nothing. Run it first, eyeball it,
--                      and (optionally) paste it back to me to double-check.
--   PART B (EXECUTE) — the actual deletes + a verification readout at the end.
--
-- Keeps: the 10 real blueprints (owner NULL), the 13 real community orgs +
-- events, and the 7 seeded announcements (your choice).
-- ============================================================================

-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PART A — PREVIEW (safe, run this first)                                  │
-- └────────────────────────────────────────────────────────────────────────┘
select 'test accounts → DELETE'      as what, email           as detail from auth.users          where email like '%@example.com' or email like '%@test.edu'
union all
select 'blueprint → DELETE',          course_code || ' · ' || coalesce(author,'') from public.shared_blueprints where user_id is not null
union all
select 'feature_request → DELETE',    title                              from public.feature_requests
union all
select 'org → DELETE',                handle || ' · ' || coalesce(name,'') from public.organizations where handle = '@alexclub'
union all
select 'access_request → DELETE',     name || ' (' || status || ')'      from public.access_requests
union all
select 'bug_report → DELETE',         title                              from public.bug_reports
union all
select 'YOUR course → WIPE',          code || ' · ' || name              from public.courses
       where user_id = (select id from auth.users where email = 'alexxdegryse@gmail.com')
order by what;

-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PART B — EXECUTE (run after you've eyeballed Part A)                     │
-- └────────────────────────────────────────────────────────────────────────┘

-- 1. fake test blueprints (the only owner-stamped ones; real blueprints owner NULL)
delete from public.shared_blueprints where user_id is not null;

-- 2. fake feature requests (cascades their comments, reactions, votes)
delete from public.feature_requests;

-- 3. test org "Alex's Club" (cascades its events)
delete from public.organizations where handle = '@alexclub';

-- 4. seeded access requests (Dr. Lila Moreau, Robotics Club, REQ-104x demos)
delete from public.access_requests;

-- 5. seeded bug reports / "known issues" (you chose: strip)
delete from public.bug_reports;

-- 6. reset YOUR account to a fresh state — keep identity, redo onboarding
delete from public.assignments      where user_id = (select id from auth.users where email = 'alexxdegryse@gmail.com');
delete from public.courses          where user_id = (select id from auth.users where email = 'alexxdegryse@gmail.com');
delete from public.todos            where user_id = (select id from auth.users where email = 'alexxdegryse@gmail.com');
delete from public.org_follows      where user_id = (select id from auth.users where email = 'alexxdegryse@gmail.com');
delete from public.event_reminders  where user_id = (select id from auth.users where email = 'alexxdegryse@gmail.com');
delete from public.blueprint_votes  where user_id = (select id from auth.users where email = 'alexxdegryse@gmail.com');
update public.user_profile set onboarding_completed = false
       where user_id = (select id from auth.users where email = 'alexxdegryse@gmail.com');

-- 7. throwaway test accounts (cascades any remaining data). LAST, so the steps
--    above can still resolve your email. If this errors on permissions, delete
--    them instead in Dashboard → Authentication → Users.
delete from auth.users where email like '%@example.com' or email like '%@test.edu';

-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ VERIFY — expect the numbers in parentheses                              │
-- └────────────────────────────────────────────────────────────────────────┘
select 'blueprints (expect 10)'        t, count(*) n from public.shared_blueprints
union all select 'feature_requests (0)',   count(*) from public.feature_requests
union all select 'bug_reports (0)',        count(*) from public.bug_reports
union all select 'access_requests (0)',    count(*) from public.access_requests
union all select 'organizations (expect 13)', count(*) from public.organizations
union all select 'announcements (kept: 7)', count(*) from public.announcements
union all select 'your courses (0)',       count(*) from public.courses where user_id = (select id from auth.users where email='alexxdegryse@gmail.com')
union all select 'test accounts (0)',      count(*) from auth.users where email like '%@example.com' or email like '%@test.edu';
