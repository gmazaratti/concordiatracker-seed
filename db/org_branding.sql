-- ── Org branding: real club logos + GameDev / CSU Advocacy updates ───────────
-- Logos are now SELF-HOSTED at concordiatracker.com/logos/* (repo public/logos,
-- deployed with the app) — no more third-party hot-linking for these orgs.
--
-- RUN AFTER the matching app deploy is live (the /logos/ URLs must resolve).
-- Safe to re-run.

-- Game Development Association → new handle, bio, links, logo
update public.organizations
set handle = '@concordiagamedev',
    bio    = 'Concordia University’s official club for game development👾👨‍💻| Everyone is welcome to join!',
    links  = '{"instagram":"https://www.instagram.com/concordiagamedev/","website":"https://linktr.ee/concordiagamedev"}'::jsonb,
    logo   = '/logos/concordiagamedev.jpg'
where handle = '@gamedev.conu';

-- Counselling & Advocacy → CSU Advocacy Center (+ site link + logo)
update public.organizations
set name  = 'CSU Advocacy Center',
    links = '{"website":"https://www.csu.qc.ca/csu-advocacy-center/"}'::jsonb,
    logo  = '/logos/csu-advocacy.png'
where handle = '@conu.caps';

-- Logos / banner for the rest of the dropped set
update public.organizations set logo = '/logos/birks.png'          where handle = '@concordia.hub';
update public.organizations set logo = '/logos/ginacody.png'       where handle = '@ginacody';
update public.organizations set logo = '/logos/hackconcordia.jpg'  where handle = '@hackconcordia';
update public.organizations set banner = '/logos/library-banner.jpg' where handle = '@concordia.library';

-- Keep the weekly seed-event refresh tracking the RENAMED handle (the deployed
-- function still lists @gamedev.conu; without this, GameDev's events would age
-- out for good). Same body as refresh_seed_events.sql, updated handle list.
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
      '@concordiagamedev', '@gamedev.conu', '@ginacody', '@concordia.hub',
      '@conu.caps', '@concordia.president', '@hackconcordia', '@conu.outdoors',
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
                days  => (1 + ((s.rn - 1) * 13) / s.span)::int,
                hours => (16 + s.rn % 4)::int,
                mins  => (case when s.rn % 2 = 0 then 30 else 0 end)::int
              ),
      posted_at = now() - make_interval(days => (1 + s.rn % 5)::int)
  from stale s
  where e.id = s.id;

  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.refresh_seed_events() from public, anon, authenticated;
