-- ============================================================================
-- Public user profiles (opt-in).
--
-- user_profile / courses are locked per-user (auth.uid() = user_id), so these
-- three SECURITY DEFINER readers are the ONLY way to read another user's data —
-- and they return it ONLY when profile_public = true. A private profile yields
-- just the handle. They are granted to anon + authenticated because the public
-- profile page (/@handle) is viewable without an account.
--
-- SECURITY: get_public_profile NEVER returns email / plan / school; courses are
-- identity-only (NO grades / assessments / GPA). Verify with the adversarial
-- checks at the bottom.
-- ============================================================================

alter table public.user_profile add column if not exists bio text;
alter table public.user_profile
  add column if not exists profile_public boolean not null default false;

-- 1. Profile — public-safe fields only. Private → handle + is_public=false + nulls.
create or replace function public.get_public_profile(p_handle text)
returns table (
  handle text,
  is_public boolean,
  name text,
  avatar_url text,
  program text,
  program_id text,
  bio text
)
language sql security definer set search_path = public stable as $$
  select
    p.handle,
    coalesce(p.profile_public, false) as is_public,
    case when p.profile_public then p.name end,
    case when p.profile_public then p.avatar_url end,
    case when p.profile_public then p.program end,
    case when p.profile_public then p.program_id end,
    case when p.profile_public then p.bio end
  from public.user_profile p
  where lower(p.handle) = lower(trim(p_handle))
  limit 1;
$$;

-- 2. Courses — identity only (code/title/color/term), public profiles only.
create or replace function public.get_public_courses(p_handle text)
returns table (code text, title text, color text, term text)
language sql security definer set search_path = public stable as $$
  select c.code, c.name as title, c.color, c.term
  from public.courses c
  join public.user_profile p on p.user_id = c.user_id
  where lower(p.handle) = lower(trim(p_handle))
    and p.profile_public = true
  order by c.code;
$$;

-- 3. Uploaded blueprints — already-public marketplace content, joined by user_id
--    (never exposed to the client), public profiles only.
create or replace function public.get_public_blueprints(p_handle text)
returns table (
  id uuid,
  course_code text,
  course_name text,
  section text,
  term text,
  verified boolean,
  upvotes int,
  downvotes int,
  imports int,
  item_count int,
  created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    b.id, b.course_code, b.course_name, b.section, b.term,
    coalesce(b.verified, false),
    coalesce(b.upvotes, 0), coalesce(b.downvotes, 0), coalesce(b.imports, 0),
    case when jsonb_typeof(b.items) = 'array' then jsonb_array_length(b.items) else 0 end,
    b.created_at
  from public.shared_blueprints b
  join public.user_profile p on p.user_id = b.user_id
  where lower(p.handle) = lower(trim(p_handle))
    and p.profile_public = true
  order by b.created_at desc;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.get_public_courses(text) to anon, authenticated;
grant execute on function public.get_public_blueprints(text) to anon, authenticated;

-- ── Adversarial checks (run after; replace the handles) ─────────────────────
-- Private profile leaks nothing but the handle:
--   select * from public.get_public_profile('<a-private-handle>');   -- is_public=false, name/etc null
--   select * from public.get_public_courses('<a-private-handle>');   -- 0 rows
--   select * from public.get_public_blueprints('<a-private-handle>'); -- 0 rows
-- Public profile exposes ONLY safe fields (no email/plan column even exists here):
--   select * from public.get_public_profile('<a-public-handle>');
-- Non-existent handle:
--   select * from public.get_public_profile('nope_nobody');          -- 0 rows
