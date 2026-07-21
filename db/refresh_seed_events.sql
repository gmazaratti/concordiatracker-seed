-- ── Refresh the seeded Community events ──────────────────────────────────────
-- WHY: phase8_community.sql seeded events with `now() + interval 'N days'`,
-- which froze into absolute timestamps at seed time (mid-June). A month later
-- every "upcoming" seed event is in the past, so the student Community feed
-- (which shows upcoming only) reads "A quiet week on campus". Nothing was
-- deleted — the events just aged out.
--
-- WHAT: a function that re-dates the SEED orgs' aged-out events forward,
-- spreading them over the next ~2 weeks (16:00–19:30 start times), and bumps
-- posted_at so "Posted Xd ago" stays plausible. It deliberately:
--   • touches ONLY the seed org handles below — real orgs (e.g.
--     @concordiatracker) and their events are never re-dated;
--   • skips the four intentionally-PAST seed events (they're written in past
--     tense and exist to fill org profiles' "Past" sections).
-- Then it runs once, and a weekly pg_cron job keeps the demo content fresh.
--
-- RUN: paste into the Supabase SQL editor and run. Safe to re-run anytime.

create or replace function public.refresh_seed_events()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  with seed_orgs as (
    select id from organizations
    where handle in (
      '@gamedev.conu', '@ginacody', '@concordia.hub', '@conu.caps',
      '@concordia.president', '@hackconcordia', '@conu.outdoors',
      '@concordia.library', '@concordia', '@jmsb', '@casa.jmsb', '@jmis',
      '@conu.mathhelp'
    )
  ),
  stale as (
    select e.id,
           row_number() over (order by e.start, e.id) as rn,
           greatest(count(*) over () - 1, 1) as span
    from events e
    join seed_orgs so on so.id = e.org_id
    where e.start < now()
      -- deliberately-past events (org-profile "Past" sections) stay past
      and e.title not in (
        'Intro to Git & GitHub workshop',
        'Capstone project showcase',
        'JMSB Welcome Week mixer',
        'CASA Frosh kickoff'
      )
  )
  update events e
  set start = date_trunc('day', now())
            + make_interval(
                days  => 1 + ((s.rn - 1) * 13) / s.span,
                hours => 16 + (s.rn % 4)::int,
                mins  => case when s.rn % 2 = 0 then 30 else 0 end
              ),
      posted_at = now() - make_interval(days => 1 + (s.rn % 5)::int)
  from stale s
  where e.id = s.id;

  get diagnostics n = row_count;
  return n;
end $$;

-- Server-side only — never callable from clients.
revoke execute on function public.refresh_seed_events() from public, anon, authenticated;

-- 1) Fix the feed right now.
select public.refresh_seed_events() as events_refreshed;

-- 2) Keep it fresh: every Monday 06:00 UTC, re-date whatever aged out.
select cron.unschedule('refresh-seed-events')
where exists (select 1 from cron.job where jobname = 'refresh-seed-events');
select cron.schedule('refresh-seed-events', '0 6 * * 1',
  $$select public.refresh_seed_events()$$);
