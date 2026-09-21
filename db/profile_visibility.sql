-- One more switch: show my major.
--
-- Classes and schedule already had their own, because "my profile exists" and
-- "here is exactly what I am taking" are not the same disclosure. Programme
-- was the odd one out — it rode on `profile_public` with no way to keep it
-- back, and it is the field that most narrows who somebody is on a campus of
-- fifty thousand.
--
-- DEFAULTS TRUE, deliberately, unlike the other two. It is already the
-- category line under a name on every product of this shape, it is what makes
-- a profile useful to a classmate, and it is far less specific than a
-- timetable. Defaulting it off would quietly empty every profile that exists
-- today.
--
-- THE SIGNATURE IS COPIED FROM THE LIVE FUNCTION, not from an earlier file in
-- db/ — the deployed one returns `program_id` as TEXT and lists `is_public`
-- ninth, and a `create or replace` that changes either would be refused or,
-- worse, silently reorder the columns the client reads positionally. Checked
-- with pg_get_functiondef before writing this.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

alter table public.user_profile
  add column if not exists program_public boolean not null default true;

comment on column public.user_profile.program_public is
  'Whether the programme/major is shown on the public profile.';

create or replace function public.get_public_profile(p_handle text)
returns table (
  user_id        uuid,
  handle         text,
  name           text,
  avatar_url     text,
  program        text,
  program_id     text,
  bio            text,
  links          jsonb,
  is_public      boolean,
  courses_public boolean
)
language sql stable security definer set search_path = public as $$
  select
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    -- Its own switch now, on top of the profile being public at all.
    case when p.profile_public and coalesce(p.program_public, true) then p.program end,
    case when p.profile_public and coalesce(p.program_public, true) then p.program_id end,
    case when p.profile_public then p.bio end,
    case when p.profile_public then coalesce(p.links, '{}'::jsonb) else '{}'::jsonb end,
    coalesce(p.profile_public, false),
    coalesce(p.courses_public, false)
  from public.user_profile p
  where lower(p.handle) = lower(trim(p_handle))
    and (
      -- Yourself, always.
      p.user_id = auth.uid()
      -- Everyone else: blocking is the only thing that hides a profile.
      -- A private one is still FOUND — it shows a name and a picture and
      -- nothing else, which is the existing contract and is asserted in
      -- db/verify.mjs.
      or not public.ct_blocked_between(auth.uid(), p.user_id)
    )
  limit 1;
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;
