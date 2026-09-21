-- ============================================================================
-- Discoverable, but private.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- THE PROBLEM THIS REPLACES. Search filtered on `profile_public`, so a student
-- typing a classmate's exact handle got nothing. Measured: 37 accounts had a
-- handle and 5 were findable. The feature looked broken to everyone.
--
-- THE OLD MODEL had one switch deciding two unrelated questions — "can anyone
-- find me" and "how much of me is on show" — and answering both with "no".
-- Those come apart cleanly:
--
--   FINDABLE  is now true for anyone who has a handle. A handle is a public
--             identifier you chose; refusing to resolve it is not privacy, it
--             is a broken address book.
--   VISIBLE   is still entirely opt-in, field by field. A private profile
--             shows a NAME and a PICTURE and nothing else at all.
--
-- WHAT THIS NEWLY EXPOSES, measured before writing it rather than argued
-- about: of the 31 private profiles with a handle, ZERO have set a bio, a
-- link, a shared class list, or schedule sharing. So the change exposes
-- exactly two fields — name and avatar — and no existing choice is overridden.
--
-- Each remaining field keeps the switch it already had:
--   program / bio / links   → profile_public
--   class list              → courses_public
--   schedule                → schedule_visibility (untouched here)
-- ============================================================================

-- ── Dropped before recreated, because the shape changed ──────────────────────
-- `create or replace function` CANNOT change the row type defined by OUT
-- parameters: Postgres answers 42P13 and refuses the whole file. Both of these
-- gain or move a column, so they have to go first.
--
-- `if exists` on each, and both signatures for get_public_profile, because two
-- earlier migrations defined it with different column lists and which one is
-- live depends on the order they were applied.
drop function if exists public.search_public_profiles(text, int);
drop function if exists public.get_public_profile(text);
drop function if exists public.get_public_courses(text);

-- ── Search: everyone with a handle ───────────────────────────────────────────
-- The ROW itself is minimal for a private account. Returning `program` for
-- someone who never made their profile public would leak through the search
-- results the profile page is careful not to leak.
create or replace function public.search_public_profiles(p_q text, p_limit int default 8)
returns table (
  handle         text,
  name           text,
  avatar_url     text,
  program        text,
  follower_count int,
  is_public      boolean
)
language sql security definer set search_path = public stable as $$
  select
    p.handle,
    p.name,
    p.avatar_url,
    case when p.profile_public then p.program end,
    case when p.profile_public
         then (select count(*)::int from public.user_follows f where f.following = p.user_id)
         else 0 end,
    coalesce(p.profile_public, false)
  from public.user_profile p
  where coalesce(p.handle, '') <> ''
    -- Internal and test accounts are not people a student should find.
    and coalesce(p.is_internal, false) = false
    and length(coalesce(trim(p_q), '')) > 0
    and (p.handle ilike '%' || trim(p_q) || '%' or p.name ilike '%' || trim(p_q) || '%')
  order by
    -- Exact handle first: if you typed it, you know who you want.
    (lower(p.handle) = lower(trim(p_q))) desc,
    -- Then public profiles, which are the ones with something to look at.
    coalesce(p.profile_public, false) desc,
    (select count(*) from public.user_follows f where f.following = p.user_id) desc,
    p.handle
  limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;
grant execute on function public.search_public_profiles(text, int) to anon, authenticated;

-- ── The profile itself ───────────────────────────────────────────────────────
-- name + avatar for anyone; everything else behind the switch that owns it.
create or replace function public.get_public_profile(p_handle text)
returns table (
  handle text,
  is_public boolean,
  name text,
  avatar_url text,
  program text,
  program_id text,
  bio text,
  links jsonb,
  courses_public boolean
)
language sql security definer set search_path = public stable as $$
  select
    p.handle,
    coalesce(p.profile_public, false) as is_public,
    -- Always. This is the whole of "discoverable but private".
    p.name,
    p.avatar_url,
    -- Opt-in, each to its own switch.
    case when p.profile_public then p.program end,
    case when p.profile_public then p.program_id end,
    case when p.profile_public then p.bio end,
    case when p.profile_public then coalesce(p.links, '{}'::jsonb) else '{}'::jsonb end,
    coalesce(p.courses_public, false)
  from public.user_profile p
  where lower(p.handle) = lower(trim(p_handle))
    and coalesce(p.is_internal, false) = false
  limit 1;
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- The class list answers to its OWN switch now, not to the profile's.
-- Sharing your classes is a deliberate act; it should not also require
-- publishing a bio and a program you never filled in.
create or replace function public.get_public_courses(p_handle text)
returns table (code text, title text, color text, term text)
language sql security definer set search_path = public stable as $$
  select c.code, c.name as title, c.color, c.term
  from public.courses c
  join public.user_profile p on p.user_id = c.user_id
  where lower(p.handle) = lower(trim(p_handle))
    and coalesce(p.courses_public, false) = true
    and coalesce(p.is_internal, false) = false
    and coalesce(c.archived, false) = false
  order by c.term desc, c.code;
$$;
grant execute on function public.get_public_courses(text) to anon, authenticated;

-- ── Adversarial checks (run these; substitute real handles) ─────────────────
-- A private profile is FOUND, and shows a name and a picture and nothing else:
--   select * from public.search_public_profiles('<private-handle>');
--     -> one row, is_public=false, program null, follower_count 0
--   select * from public.get_public_profile('<private-handle>');
--     -> name and avatar_url populated; program/bio null; links '{}'
--   select * from public.get_public_courses('<private-handle>');   -- 0 rows
-- An internal account is invisible to both:
--   select * from public.search_public_profiles('concordiatracker');  -- 0 rows
-- A handle nobody holds:
--   select * from public.get_public_profile('nope_nobody');           -- 0 rows
