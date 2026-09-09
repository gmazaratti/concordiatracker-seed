-- ─────────────────────────────────────────────────────────────────────────────
-- Following a person, alongside connecting with them.
--
-- Two different relationships, which is why both exist rather than one:
--
--   FOLLOW   one-way, needs nobody's permission, grants nothing. You see what
--            they publish publicly and that is all. Like following on LinkedIn
--            or X — an interest, not an agreement.
--   FRIEND   two-way, requires acceptance, and is the ONLY thing that unlocks
--            anything: messages, and a schedule if they chose to share it.
--
-- Keeping them separate is what stops "add friend" from becoming a button
-- people press on strangers to see their timetable. Following is the low-stakes
-- action, so the high-stakes one can stay meaningful.
--
-- A follow reveals nothing a public profile does not already show, so there is
-- no acceptance step and no notification obligation.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_follows (
  follower   uuid not null references auth.users (id) on delete cascade,
  following  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, following),
  constraint user_follows_not_self check (follower <> following)
);

create index if not exists user_follows_following_idx on public.user_follows (following);

alter table public.user_follows enable row level security;

-- You can see who YOU follow, and who follows you. Not who follows someone
-- else: a follower list is a social graph, and publishing one invites exactly
-- the comparison this app exists to avoid.
drop policy if exists user_follows_select_own on public.user_follows;
create policy user_follows_select_own on public.user_follows
  for select to authenticated
  using (auth.uid() = follower or auth.uid() = following);

drop policy if exists user_follows_insert_own on public.user_follows;
create policy user_follows_insert_own on public.user_follows
  for insert to authenticated
  with check (auth.uid() = follower);

-- Unfollow is yours alone. Nobody can remove a follower on someone's behalf,
-- and the person being followed cannot silently drop you either — blocking is
-- a different feature with different consequences, and it is not this one.
drop policy if exists user_follows_delete_own on public.user_follows;
create policy user_follows_delete_own on public.user_follows
  for delete to authenticated
  using (auth.uid() = follower);

/**
 * The people you follow, with enough profile to list them.
 *
 * Counts are deliberately absent: a follower count on a student profile turns a
 * study tool into a popularity contest, which is the one thing CLAUDE.md's
 * "no leaderboard" rule is protecting against.
 */
create or replace function public.my_following()
returns table (
  user_id uuid,
  handle text,
  name text,
  avatar_url text,
  program text,
  created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select p.user_id, p.handle, p.name, p.avatar_url, p.program, f.created_at
  from public.user_follows f
  join public.user_profile p on p.user_id = f.following
  where f.follower = auth.uid()
  order by f.created_at desc;
$$;

/** Do I follow this handle? One boolean, nothing about anyone else. */
create or replace function public.am_following(p_handle text)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.user_follows f
    join public.user_profile p on p.user_id = f.following
    where f.follower = auth.uid() and lower(p.handle) = lower(trim(p_handle))
  );
$$;

grant execute on function public.my_following() to authenticated;
grant execute on function public.am_following(text) to authenticated;
revoke execute on function public.my_following() from anon;
revoke execute on function public.am_following(text) from anon;
