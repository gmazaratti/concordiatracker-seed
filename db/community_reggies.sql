-- ============================================================================
-- Community: Reggies, a weekly night, the Game Dev summit, and brand assets.
-- Run in the SQL editor. Idempotent — safe to run again; re-running REFRESHES
-- the Thursday dates rather than duplicating them.
--
-- WHY THIS IS A MIGRATION AND NOT A CHANGE TO src/data/community.ts:
-- since Phase 8 the feed reads `organizations` + `events` from the database.
-- The TypeScript seed is the source the tables were built FROM, not the source
-- the app renders — editing it alone changes nothing a student sees.
-- ============================================================================

-- ── New optional columns ─────────────────────────────────────────────────────
-- `venue` is for an org that is also a PLACE. A bar has an address, a phone
-- and opening hours; none of that reads well squeezed into a bio paragraph.
-- `email` makes Contact a real mailto: — a dead button that looks live is
-- worse than one that admits it is a stub, so the UI only switches when this
-- is set.
alter table public.organizations add column if not exists email text;
alter table public.organizations add column if not exists venue jsonb;

-- A weekly night is many events, but a feed listing four copies of the same
-- party reads as a bug. Occurrences sharing `series_id` collapse to the next
-- one in the FEED and carry `recurrence` as the label; the org's own profile
-- and the calendar still see every date, which is where that matters.
alter table public.events add column if not exists series_id  text;
alter table public.events add column if not exists recurrence text;

create index if not exists events_series_idx on public.events (series_id);

-- ── Reggies ──────────────────────────────────────────────────────────────────
insert into public.organizations (handle, name, verified, glyph, color, logo, banner, bio, links, venue, status)
values (
  '@reggiesmtl',
  'Reggies',
  true,
  'RG',
  '#d6322e',
  '/logos/reggies.png',
  '/logos/reggies-banner.jpg',
  'Concordia''s own bar, on the mezzanine of the Hall building. Pints, pub food and a room that is already full of people you know — open to students and the neighbourhood alike.',
  '{"instagram":"https://www.instagram.com/reggiesmtl/","website":"https://reggies.ca"}'::jsonb,
  jsonb_build_object(
    'address', '1455 Blvd. De Maisonneuve Ouest, Montreal, QC',
    'phone', '(514) 789-2447',
    'hours', jsonb_build_array(
      'Monday–Wednesday · 10am–11pm',
      'Thursday–Friday · 10am–2am',
      'Saturday–Sunday · private events only'
    )
  ),
  'approved'
)
on conflict (handle) do update set
  name     = excluded.name,
  verified = excluded.verified,
  glyph    = excluded.glyph,
  color    = excluded.color,
  logo     = excluded.logo,
  banner   = excluded.banner,
  bio      = excluded.bio,
  links    = excluded.links,
  venue    = excluded.venue;

-- ── Thirsty Thursdays ────────────────────────────────────────────────────────
-- Maintained by db/reggies_next_three.sql — `roll_reggies_series()` keeps
-- exactly the next three Thursdays and runs daily. This file used to insert
-- thirty, which flooded every list the club appears in; generating them here
-- as well would put the flood back every time this file is re-run.
-- A DO block, not `select ... where exists`: Postgres resolves a function
-- name when it PARSES the statement, so the WHERE never gets a chance and a
-- project without the function fails on this line.
do $$
begin
  if to_regprocedure('public.roll_reggies_series()') is not null then
    perform public.roll_reggies_series();
  end if;
end $$;

-- ── Concordia Game Dev: Student Game Dev Summit ──────────────────────────────
-- The date is the one the club publishes. If that is in the past relative to
-- today it sits under "Past" on their profile rather than in the feed —
-- nudging it forward to make it look live would be inventing a date.
delete from public.events where title = 'Student Game Dev Summit 2026';

insert into public.events (org_id, title, start, mode, location, category, description, relevant_to, posted_at)
select
  o.id,
  'Student Game Dev Summit 2026',
  timestamptz '2026-05-02 18:00:00-04',
  'in-person',
  'ÉTS · Salon des diplômés E-2033, 1220 rue Notre-Dame Ouest',
  'clubs',
  'An inter-university event designed to inspire growth and collaboration among students interested in pursuing game development. Whether you are a programmer, artist, musician or game designer, this is a space to meet people, network, and explore what the future of Quebec''s gaming industry will look like. 6–9 PM, 2nd floor of pavillon E at ÉTS.',
  array['Computer Science', 'Computation Arts', 'Design', 'Gina Cody', 'Fine Arts'],
  timestamptz '2026-04-01 12:00:00-04'
from public.organizations o
where o.handle = '@concordiagamedev';

-- ── Brand assets supplied by the user ────────────────────────────────────────
-- Concordia's own mark and a campus banner; the maroon is their real brand
-- colour, which the placeholder rose was not.
update public.organizations
   set logo = '/logos/concordia.png',
       banner = '/logos/concordia-banner.jpg',
       color = '#912338'
 where handle = '@concordia';

update public.organizations
   set banner = '/logos/jmis-banner.jpg',
       email  = 'directors@jmis.ca'
 where handle = '@jmis';

-- ── What landed ──────────────────────────────────────────────────────────────
select o.handle,
       count(e.id) filter (where e.start >= now()) as upcoming,
       min(e.start) filter (where e.start >= now()) as next_one
  from public.organizations o
  left join public.events e on e.org_id = o.id
 where o.handle in ('@reggiesmtl', '@concordiagamedev', '@concordia', '@jmis')
 group by o.handle
 order by o.handle;
