-- ─────────────────────────────────────────────────────────────────────────────
-- Friends, direct messages, and finer-grained profile privacy.
--
-- THE RULE THIS WHOLE FILE IS BUILT AROUND: a grade never leaves its owner.
-- Not to a friend, not in a message, not through any function here. The public
-- profile RPCs already return course identity only (code / title / colour /
-- term) and that does not change; what is added is the ability to share a
-- TIMETABLE with people you have actually agreed to share it with, which is a
-- different fact about a different thing.
--
-- Privacy defaults, all of them closed:
--   profile_public      already defaults false
--   courses_public      false — your class list is its own decision, because
--                       "my profile exists" and "here is exactly what I am
--                       taking and when" are not the same disclosure
--   schedule_visibility 'private' — friends can see it only if you say so
--
-- Every read goes through a SECURITY DEFINER function with the friendship check
-- inside it, so the rule cannot be forgotten at a call site.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profile fields ──────────────────────────────────────────────────────────
alter table public.user_profile
  add column if not exists courses_public boolean not null default false,
  add column if not exists schedule_visibility text not null default 'private',
  -- {"instagram":"handle","linkedin":"url","website":"url","x":"handle"}
  add column if not exists links jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profile_schedule_visibility_chk'
  ) then
    alter table public.user_profile
      add constraint user_profile_schedule_visibility_chk
      check (schedule_visibility in ('private', 'friends'));
  end if;
end $$;

-- ── Friendships ─────────────────────────────────────────────────────────────
-- One row per pair. `least/greatest` on the ids in a unique index means A→B and
-- B→A cannot both exist, so "did I already ask them" never needs two queries
-- and a race cannot produce a duplicate friendship.
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester    uuid not null references auth.users (id) on delete cascade,
  addressee    uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester <> addressee)
);

create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee, status);
create index if not exists friendships_requester_idx on public.friendships (requester, status);

alter table public.friendships enable row level security;

drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships
  for select to authenticated
  using (auth.uid() = requester or auth.uid() = addressee);

-- You may only ever create a request AS yourself, and only pending.
drop policy if exists friendships_insert_own on public.friendships;
create policy friendships_insert_own on public.friendships
  for insert to authenticated
  with check (auth.uid() = requester and status = 'pending');

-- Only the person who was ASKED can accept. Without the `addressee` check a
-- requester could accept their own request and add themselves to someone's
-- friend list, which is the whole reason this is a two-party record.
drop policy if exists friendships_accept on public.friendships;
create policy friendships_accept on public.friendships
  for update to authenticated
  using (auth.uid() = addressee)
  with check (auth.uid() = addressee);

-- Either side can walk away, at any point, without asking the other.
drop policy if exists friendships_delete_either on public.friendships;
create policy friendships_delete_either on public.friendships
  for delete to authenticated
  using (auth.uid() = requester or auth.uid() = addressee);

/** Are these two accepted friends? The single source for every check below. */
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

-- ── Messages ────────────────────────────────────────────────────────────────
-- An attachment is a REFERENCE, never a copy: {"kind":"schedule","id":"…"} or
-- {"kind":"course","code":"COMM 225"}. So a shared schedule shows what it says
-- today rather than what it said in March, and nothing about a course travels
-- into the message body where it could outlive the sender's privacy settings.
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender      uuid not null references auth.users (id) on delete cascade,
  recipient   uuid not null references auth.users (id) on delete cascade,
  body        text not null default '',
  attachment  jsonb,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  constraint messages_not_self check (sender <> recipient),
  constraint messages_not_empty check (length(trim(body)) > 0 or attachment is not null),
  constraint messages_body_len check (length(body) <= 4000)
);

create index if not exists messages_pair_idx
  on public.messages (least(sender, recipient), greatest(sender, recipient), created_at desc);
create index if not exists messages_unread_idx on public.messages (recipient, read_at);

alter table public.messages enable row level security;

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
  for select to authenticated
  using (auth.uid() = sender or auth.uid() = recipient);

-- You can only write as yourself, and only to a friend. The friendship check
-- lives in the POLICY rather than in the client, so there is no version of this
-- app — or of a script pointed at our API — that can cold-message a stranger.
drop policy if exists messages_insert_to_friend on public.messages;
create policy messages_insert_to_friend on public.messages
  for insert to authenticated
  with check (auth.uid() = sender and public.are_friends(auth.uid(), recipient));

-- The recipient marks it read. Nobody edits a message after the fact: an
-- editable message log is one nobody can trust.
drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages
  for update to authenticated
  using (auth.uid() = recipient)
  with check (auth.uid() = recipient);

-- Either side can delete their own copy of the conversation's rows.
drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
  for delete to authenticated
  using (auth.uid() = sender or auth.uid() = recipient);

-- ── Reads that need the friendship rule enforced ────────────────────────────

/**
 * Your friends and pending requests, with the profile bits needed to render a
 * list. `direction` tells the UI whether a pending row is yours to answer.
 */
create or replace function public.my_friends()
returns table (
  friendship_id uuid,
  user_id uuid,
  handle text,
  name text,
  avatar_url text,
  program text,
  status text,
  direction text,
  created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    f.id,
    other.user_id,
    other.handle,
    other.name,
    other.avatar_url,
    other.program,
    f.status,
    case when f.requester = auth.uid() then 'outgoing' else 'incoming' end,
    f.created_at
  from public.friendships f
  join public.user_profile other
    on other.user_id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by f.status, f.created_at desc;
$$;

/**
 * A friend's timetable — the courses they are taking with when and where.
 *
 * Returns NOTHING unless you are accepted friends AND they set
 * schedule_visibility to 'friends'. Deliberately no grades, no assessments and
 * no GPA: this answers "when are you free", which is the only question anyone
 * asked. The empty result is the same shape whether they are not your friend or
 * have it switched off, so this cannot be used to probe someone's settings.
 */
create or replace function public.get_friend_schedule(p_handle text)
returns table (code text, title text, color text, term text, meeting_times text, location text)
language sql security definer set search_path = public stable as $$
  select c.code, c.name, c.color, c.term, c.time, c.location
  from public.courses c
  join public.user_profile p on p.user_id = c.user_id
  where lower(p.handle) = lower(trim(p_handle))
    and p.schedule_visibility = 'friends'
    and public.are_friends(auth.uid(), p.user_id)
    and coalesce(c.archived, false) = false
  order by c.code;
$$;

/** Whether the viewer may see this person's timetable — so the UI can ask
 *  before it renders an empty panel that looks like a bug. */
create or replace function public.can_see_schedule(p_handle text)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.user_profile p
    where lower(p.handle) = lower(trim(p_handle))
      and p.schedule_visibility = 'friends'
      and public.are_friends(auth.uid(), p.user_id)
  );
$$;

/** Resolve a handle to a user id, for sending a request. Nothing else leaks. */
create or replace function public.user_id_for_handle(p_handle text)
returns uuid
language sql security definer set search_path = public stable as $$
  select user_id from public.user_profile
  where lower(handle) = lower(trim(p_handle)) limit 1;
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.get_friend_schedule(text) to authenticated;
grant execute on function public.can_see_schedule(text) to authenticated;
grant execute on function public.user_id_for_handle(text) to authenticated;

-- Anonymous visitors have no business asking any of these.
revoke execute on function public.my_friends() from anon;
revoke execute on function public.get_friend_schedule(text) from anon;
revoke execute on function public.can_see_schedule(text) from anon;
revoke execute on function public.user_id_for_handle(text) from anon;

-- ── The course list gets its own switch ─────────────────────────────────────
-- Previously courses rode on `profile_public`, so making a profile visible at
-- all published the class list with it. They are separate disclosures now, and
-- the new one defaults to off — nobody's timetable becomes public because they
-- turned a profile on.
-- Same shape as before, so a replace would work — dropped anyway so the two
-- redefinitions in this file behave identically and neither is a special case.
drop function if exists public.get_public_courses(text);
create or replace function public.get_public_courses(p_handle text)
returns table (code text, title text, color text, term text)
language sql security definer set search_path = public stable as $$
  select c.code, c.name as title, c.color, c.term
  from public.courses c
  join public.user_profile p on p.user_id = c.user_id
  where lower(p.handle) = lower(trim(p_handle))
    and p.profile_public = true
    and p.courses_public = true
    and coalesce(c.archived, false) = false
  order by c.term desc, c.code;
$$;

-- Links join the public profile. Only ever what the owner typed, and only on a
-- public profile.
--
-- DROPPED first, not just replaced: `create or replace` cannot change a
-- function's OUT columns, and this one gains two. Safe because it is recreated
-- immediately below and nothing but the app calls it.
drop function if exists public.get_public_profile(text);
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
    case when p.profile_public then p.name end,
    case when p.profile_public then p.avatar_url end,
    case when p.profile_public then p.program end,
    case when p.profile_public then p.program_id end,
    case when p.profile_public then p.bio end,
    case when p.profile_public then coalesce(p.links, '{}'::jsonb) else '{}'::jsonb end,
    case when p.profile_public then coalesce(p.courses_public, false) else false end
  from public.user_profile p
  where lower(p.handle) = lower(trim(p_handle))
  limit 1;
$$;

-- Recreating a function drops its grants with it.
grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.get_public_courses(text) to anon, authenticated;

-- Check:
--   select count(*) from public.friendships;
--   select proname from pg_proc where proname in
--     ('are_friends','my_friends','get_friend_schedule','can_see_schedule');
