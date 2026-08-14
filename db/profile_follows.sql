-- ── Following people (not just orgs) ─────────────────────────────────────────
-- Org follows are still an in-memory stub; THIS is real and persisted, because
-- follower counts are shown publicly and a number that resets on reload is worse
-- than no number.
--
-- PRIVACY: the follower COUNT is public, the follower LIST is not. Letting
-- anyone enumerate who follows whom would publish a social graph of students,
-- which this product has no reason to expose. You can read your own follows;
-- everything else comes from admin-free SECURITY DEFINER functions that return
-- aggregates only.
--
-- RUN AFTER db/public_profiles.sql. Safe to re-run.

create table if not exists public.profile_follows (
  follower_id  uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  -- Following yourself would inflate your own count.
  constraint no_self_follow check (follower_id <> following_id)
);

create index if not exists profile_follows_following_idx on public.profile_follows (following_id);

alter table public.profile_follows enable row level security;

-- You may read and manage only your OWN follows.
drop policy if exists "follows own select" on public.profile_follows;
create policy "follows own select" on public.profile_follows
  for select using (auth.uid() = follower_id);

drop policy if exists "follows own insert" on public.profile_follows;
create policy "follows own insert" on public.profile_follows
  for insert with check (auth.uid() = follower_id);

drop policy if exists "follows own delete" on public.profile_follows;
create policy "follows own delete" on public.profile_follows
  for delete using (auth.uid() = follower_id);

grant select, insert, delete on public.profile_follows to authenticated;

-- ── Search public profiles ───────────────────────────────────────────────────
-- Only profiles the student has explicitly made public are searchable — a
-- private profile is invisible here, not merely hidden in the UI.
create or replace function public.search_public_profiles(p_q text, p_limit int default 8)
returns table (
  handle         text,
  name           text,
  avatar_url     text,
  program        text,
  follower_count int
)
language sql security definer set search_path = public stable as $$
  select
    p.handle,
    p.name,
    p.avatar_url,
    p.program,
    (select count(*)::int from public.profile_follows f where f.following_id = p.user_id)
  from public.user_profile p
  where coalesce(p.profile_public, false) = true
    and coalesce(p.handle, '') <> ''
    and length(coalesce(trim(p_q), '')) > 0
    and (p.handle ilike '%' || trim(p_q) || '%' or p.name ilike '%' || trim(p_q) || '%')
  order by
    -- Exact handle first, then the better-known accounts.
    (lower(p.handle) = lower(trim(p_q))) desc,
    (select count(*) from public.profile_follows f where f.following_id = p.user_id) desc,
    p.handle
  limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;
grant execute on function public.search_public_profiles(text, int) to anon, authenticated;

-- ── One profile's follow stats ───────────────────────────────────────────────
-- Count only, plus whether the CALLER follows them. Never the list.
create or replace function public.profile_follow_stats(p_handle text)
returns table (follower_count int, following_count int, i_follow boolean)
language sql security definer set search_path = public stable as $$
  select
    (select count(*)::int from public.profile_follows f
       join public.user_profile t on t.user_id = f.following_id
      where t.handle = p_handle),
    (select count(*)::int from public.profile_follows f
       join public.user_profile s on s.user_id = f.follower_id
      where s.handle = p_handle),
    exists (
      select 1 from public.profile_follows f
       join public.user_profile t on t.user_id = f.following_id
      where t.handle = p_handle and f.follower_id = auth.uid()
    );
$$;
grant execute on function public.profile_follow_stats(text) to anon, authenticated;

-- ── Follow / unfollow by handle ──────────────────────────────────────────────
-- Returns the resulting state, so the client never has to guess.
create or replace function public.toggle_profile_follow(p_handle text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare target uuid; existing int;
begin
  if auth.uid() is null then raise exception 'Sign in to follow people.'; end if;

  select user_id into target from public.user_profile
   where handle = p_handle and coalesce(profile_public, false) = true;
  if target is null then raise exception 'That profile is not public.'; end if;
  if target = auth.uid() then raise exception 'You cannot follow yourself.'; end if;

  delete from public.profile_follows
   where follower_id = auth.uid() and following_id = target;
  get diagnostics existing = row_count;
  if existing > 0 then return false; end if;

  insert into public.profile_follows (follower_id, following_id) values (auth.uid(), target);
  return true;
end $$;
grant execute on function public.toggle_profile_follow(text) to authenticated;

-- ── The people I follow ──────────────────────────────────────────────────────
create or replace function public.my_followed_profiles()
returns table (handle text, name text, avatar_url text, program text, follower_count int)
language sql security definer set search_path = public stable as $$
  select p.handle, p.name, p.avatar_url, p.program,
         (select count(*)::int from public.profile_follows f2 where f2.following_id = p.user_id)
  from public.profile_follows f
  join public.user_profile p on p.user_id = f.following_id
  where f.follower_id = auth.uid()
  order by f.created_at desc;
$$;
grant execute on function public.my_followed_profiles() to authenticated;
