-- `is_internal` should stop you being COUNTED, not stop you being SEEN.
--
-- THE BUG, reported as "right-clicking someone in chat and View profile does
-- not work" and as "@concordiatracker isn't here". Both are the same thing:
-- every profile function excluded internal accounts from everyone except
-- their owner, so visiting one by handle returned nothing and the page said
-- the handle was not registered.
--
-- MEASURED BEFORE CHANGING ANYTHING. Thirteen accounts carry the flag, and
-- they are not junk — they are the founder, the brand account, and eleven
-- real people who were testing. Four of them have `profile_public = true`,
-- which is the switch the UI actually offers and the promise it actually
-- makes. Reproduced both halves with a disposable account: an ordinary
-- profile loads, the identical request for an internal one returns "isn't
-- here".
--
-- TWO JOBS WERE CONFLATED. `is_internal` exists so staff and test accounts
-- do not inflate the user count, the paying-customer count or the signup
-- alerts — and it should keep doing exactly that, untouched, in
-- ct_*_raw()/admin_*(). It was never a privacy control, and using it as one
-- meant the product's own brand profile 404'd for every student while the
-- one switch a person can see had no effect.
--
-- So visibility is `profile_public` and blocking, which is what they are for.
--
-- RUN in the Supabase SQL editor. Safe to re-run. Requires db/blocks.sql.

-- Dropped first: `create or replace` cannot change a function's return type
-- ("cannot change return type of existing function"), and these columns are
-- not identical to the versions already installed. Both halves run in one
-- batch, so nothing is missing for longer than the statement takes.
drop function if exists public.get_public_profile(text);
drop function if exists public.get_public_courses(text);
drop function if exists public.search_public_profiles(text);

create or replace function public.get_public_profile(p_handle text)
returns table (
  user_id        uuid,
  handle         text,
  name           text,
  avatar_url     text,
  program        text,
  -- program_id was in the previous version and the client reads it; dropping
  -- it here would have silently emptied the programme chip on every profile.
  program_id     text,
  bio            text,
  links          jsonb,
  is_public      boolean,
  courses_public boolean
)
language sql security definer set search_path = public as $$
  select
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    case when p.profile_public then p.program end,
    case when p.profile_public then p.program_id end,
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

create or replace function public.get_public_courses(p_handle text)
returns table (code text, title text, color text, term text)
language sql security definer set search_path = public as $$
  select c.code, c.name as title, c.color, c.term
  from public.courses c
  join public.user_profile p on p.user_id = c.user_id
  where lower(p.handle) = lower(trim(p_handle))
    and coalesce(c.archived, false) = false
    and (
      p.user_id = auth.uid()
      or (
        coalesce(p.courses_public, false) = true
        and not public.ct_blocked_between(auth.uid(), p.user_id)
      )
    )
  order by c.term desc, c.code;
$$;
grant execute on function public.get_public_courses(text) to anon, authenticated;

-- SEARCH KEEPS ITS OWN RULE, deliberately different. A profile you reach by
-- typing its handle is one you were already told about; the directory is
-- where a stranger browses, and a throwaway test account has no business in
-- it. Internal accounts stay out of search UNLESS they are deliberately
-- public — which is how the founder and the brand account appear, and how a
-- probe created for ten minutes does not.
create or replace function public.search_public_profiles(p_q text)
returns table (
  user_id        uuid,
  handle         text,
  name           text,
  avatar_url     text,
  program        text,
  is_public      boolean,
  follower_count int
)
language sql security definer set search_path = public as $$
  select
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    case when p.profile_public then p.program end,
    coalesce(p.profile_public, false),
    case when p.profile_public
         then (select count(*)::int from public.user_follows f where f.following = p.user_id)
         else 0 end
  from public.user_profile p
  where p.handle is not null
    and (
      p.handle ilike '%' || trim(p_q) || '%'
      or p.name ilike '%' || trim(p_q) || '%'
    )
    and (coalesce(p.is_internal, false) = false or coalesce(p.profile_public, false) = true)
    and not public.ct_blocked_between(auth.uid(), p.user_id)
  order by
    (select count(*) from public.user_follows f where f.following = p.user_id) desc,
    p.handle
  limit 20;
$$;
grant execute on function public.search_public_profiles(text) to anon, authenticated;
