-- ============================================================================
-- Reggies' Thirsty Thursdays: the next three, always, and no more.
--
-- WHY THREE: thirty real Thursdays flooded every list the club appears in.
-- A weekly night needs to show the next few dates someone might plan around,
-- not a semester of identical rows.
--
-- WHY A FUNCTION ON A SCHEDULE, NOT A ONE-OFF TRIM: three rows written today
-- are zero upcoming rows in three weeks. `roll_reggies_series` keeps exactly
-- the next three and runs daily, so the list never runs dry and never grows.
--
-- EXISTING ROWS ARE KEPT, NOT RE-CREATED. A Thursday that is already in the
-- table keeps its id, because somebody may have reposted it or opened it from
-- a notification; deleting and re-inserting would break both. Only dates
-- outside the next three are removed, and only missing dates are added.
--
-- "Tonight" still counts until doors open at 8 PM, Montreal time.
-- ============================================================================

create or replace function public.roll_reggies_series()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tz constant text := 'America/Toronto';
  org uuid;
  today date := (now() at time zone tz)::date;
  first_thu date;
  d date;
  added int := 0;
begin
  select id into org from public.organizations where handle = '@reggiesmtl';
  if org is null then return 0; end if;

  -- isodow: Monday 1 … Thursday 4 … Sunday 7.
  first_thu := today + ((4 - extract(isodow from today)::int + 7) % 7);
  if first_thu = today and (now() at time zone tz)::time >= time '20:00' then
    first_thu := first_thu + 7;
  end if;

  delete from public.events
   where series_id = 'reggies-thirsty-thursdays'
     and (start at time zone tz)::date not in (first_thu, first_thu + 7, first_thu + 14);

  for i in 0..2 loop
    d := first_thu + i * 7;
    if not exists (
      select 1 from public.events
       where series_id = 'reggies-thirsty-thursdays'
         and (start at time zone tz)::date = d
    ) then
      insert into public.events
        (org_id, title, start, mode, location, category, description, posted_at, series_id, recurrence)
      values
        (org, 'Thirsty Thursdays', (d + time '20:00') at time zone tz, 'in-person',
         'Reggies · Hall building mezzanine', 'nightlife',
         'The weekly night at Reggies: cheap pints, a full room and whoever is around. Doors from 8 PM until close — the bar runs to 2 AM on a Thursday. Student ID at the door; 18+.',
         now(), 'reggies-thirsty-thursdays', 'Every Thursday');
      added := added + 1;
    end if;
  end loop;
  return added;
end $$;

select public.roll_reggies_series();

-- Daily, a little after the seed refresh. Guarded: a project without pg_cron
-- still gets the function and today's trim, and says so rather than failing
-- the whole file (the lesson from outline_sync.sql).
do $$
begin
  perform cron.unschedule('ct-roll-reggies')
    where exists (select 1 from cron.job where jobname = 'ct-roll-reggies');
  perform cron.schedule('ct-roll-reggies', '20 6 * * *', 'select public.roll_reggies_series()');
exception when others then
  raise notice 'pg_cron is not available here; run select public.roll_reggies_series(); weekly by hand.';
end $$;
