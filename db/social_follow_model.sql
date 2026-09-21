-- Follows become the whole social graph. A connection is a mutual follow.
--
-- WHAT CHANGES. There were two relationships doing overlapping jobs:
-- `friendships` (request → accept, two-way, gated messaging) and
-- `user_follows` (one-way, public, granted nothing). A student had to learn
-- both. Now there is one: you follow someone, and if they follow you back
-- that IS the connection — derived, never stored, so the two can never
-- disagree about whether you are connected.
--
-- MESSAGING, and this is the part with teeth. Anyone may message anyone, but
-- a stranger gets ONE message and it arrives as a request. That is the
-- Instagram rule, and it is chosen deliberately over "mutuals only" because
-- a first message is how anything starts — while an unlimited channel to a
-- stranger is how a product aimed at students becomes a harassment surface.
-- The one-message limit is the whole safety property, so it lives in the
-- DATABASE and not in a handler somebody can route around.
--
-- AND THE RECIPIENT CAN TURN IT DOWN FURTHER. `dm_policy`:
--   everyone  — default: strangers get one request, mutuals unlimited
--   mutuals   — only people you follow back can write at all
--   off       — nobody, including mutuals
-- Their setting, checked on the write, not a filter on their inbox: a
-- message that should not have been sent should not exist.
--
-- FRIENDSHIPS ARE MIGRATED, NOT DROPPED. Every accepted friendship becomes
-- two follows, so nobody loses a connection they already had. The table is
-- left in place (unread, for now) rather than deleted, because a migration
-- that destroys the only copy of a relationship graph is not one you can
-- undo if this is wrong.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

-- ── 1. Carry the existing connections over ──────────────────────────────────
insert into public.user_follows (follower, following)
select f.requester, f.addressee from public.friendships f where f.status = 'accepted'
on conflict do nothing;

insert into public.user_follows (follower, following)
select f.addressee, f.requester from public.friendships f where f.status = 'accepted'
on conflict do nothing;

-- ── 2. The setting ──────────────────────────────────────────────────────────
alter table public.user_profile
  add column if not exists dm_policy text not null default 'everyone';

do $$ begin
  alter table public.user_profile
    add constraint user_profile_dm_policy_ck
    check (dm_policy in ('everyone', 'mutuals', 'off'));
exception when duplicate_object then null; end $$;

comment on column public.user_profile.dm_policy is
  'Who may start a conversation: everyone (strangers get one request) | mutuals | off.';

-- ── 3. The primitives ───────────────────────────────────────────────────────
create or replace function public.ct_follows(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_follows f
     where f.follower = p_a and f.following = p_b
  );
$$;

/** Mutual follow — what the product calls a connection. */
create or replace function public.ct_is_mutual(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_a is not null and p_b is not null
     and public.ct_follows(p_a, p_b)
     and public.ct_follows(p_b, p_a);
$$;

-- ── 4. The write gate ───────────────────────────────────────────────────────
-- THE STRANGER RULES MOVE HERE, THEY ARE NOT DROPPED. Opening `messages` to
-- non-friends would otherwise have quietly removed the three protections that
-- only lived inside `send_message_request`: no links, a length cap, and a
-- daily ceiling. The no-link rule in particular is the single thing standing
-- between "you can say hello to a classmate" and "we built a phishing channel
-- aimed at students", so it belongs on the WRITE and not in a helper somebody
-- can route around.
--
-- The body-aware overload is what the POLICY calls. The two-argument one is
-- what the UI calls before anything is typed, to decide whether the Message
-- button is live at all.
create or replace function public.ct_dm_block_reason(p_from uuid, p_to uuid, p_body text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  policy text;
  sent   int;
  body   text := coalesce(p_body, '');
begin
  if p_from is null or p_to is null then return 'auth'; end if;
  if p_from = p_to then return 'self'; end if;
  if public.ct_blocked_between(p_from, p_to) then return 'blocked'; end if;

  select coalesce(up.dm_policy, 'everyone') into policy
    from public.user_profile up where up.user_id = p_to;

  if policy = 'off' then return 'closed'; end if;
  -- Once they follow you back the conversation is ordinary: no cap, no length
  -- limit, links allowed. That is the whole reward for being followed back.
  if public.ct_is_mutual(p_from, p_to) then return null; end if;
  if policy = 'mutuals' then return 'mutuals-only'; end if;

  -- A stranger gets ONE, ever, until they are followed back. Counting their
  -- own sent messages (rather than a flag) means the limit survives the
  -- recipient deleting the thread.
  select count(*) into sent
    from public.messages m
   where m.sender = p_from and m.recipient = p_to;
  if sent >= 1 then return 'request-pending'; end if;

  -- Ten a day across everyone: generous for a person, useless for a bot.
  select count(*) into sent
    from public.messages m
   where m.sender = p_from and m.is_request
     and m.created_at > now() - interval '24 hours';
  if sent >= 10 then return 'rate'; end if;

  -- Body checks only when there is a body to check, so the 2-arg form can ask
  -- "could I write to them at all" before a word has been typed.
  if p_body is not null then
    if length(body) > 500 then return 'too-long'; end if;
    if public.ct_has_link(body) then return 'link'; end if;
  end if;

  return null;
end; $$;

create or replace function public.ct_dm_block_reason(p_from uuid, p_to uuid)
returns text
language sql stable security definer set search_path = public as $$
  select public.ct_dm_block_reason(p_from, p_to, null::text);
$$;

grant execute on function public.ct_is_mutual(uuid, uuid) to authenticated;
grant execute on function public.ct_dm_block_reason(uuid, uuid) to authenticated;
grant execute on function public.ct_dm_block_reason(uuid, uuid, text) to authenticated;

-- Replaces the accepted-friendship policy. Same principle: the rule is in the
-- policy, so no version of this app — or a script pointed at our API — can
-- cold-message somebody past it.
drop policy if exists messages_insert_to_friend on public.messages;
drop policy if exists messages_insert_allowed on public.messages;
create policy messages_insert_allowed on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender
    and public.ct_dm_block_reason(auth.uid(), recipient, body) is null
  );

-- A first message to a stranger is a REQUEST, stamped by the database rather
-- than by whoever is writing the row.
create or replace function public.ct_stamp_request()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.is_request := not public.ct_is_mutual(new.sender, new.recipient);
  return new;
end; $$;

drop trigger if exists ct_stamp_request on public.messages;
create trigger ct_stamp_request
  before insert on public.messages
  for each row execute function public.ct_stamp_request();

-- ── 5. What a profile needs, in one call ────────────────────────────────────
-- Counts, the viewer's relationship to them, and the mutuals preview — all of
-- it at once, because the header renders as a unit and four round trips to
-- draw one block is how a profile page ends up popping into place.
create or replace function public.profile_social(p_handle text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  them   uuid;
  result jsonb;
begin
  select up.user_id into them from public.user_profile up
   where lower(up.handle) = lower(trim(p_handle));
  if them is null then return null; end if;

  select jsonb_build_object(
    'user_id',    them,
    'followers',  (select count(*) from public.user_follows f where f.following = them),
    'following',  (select count(*) from public.user_follows f where f.follower  = them),
    -- Orgs replaces Instagram's post count: organisations they follow.
    'orgs',       (select count(*) from public.org_follows o where o.user_id = them),
    'i_follow',   public.ct_follows(me, them),
    'follows_me', public.ct_follows(them, me),
    'mutual',     public.ct_is_mutual(me, them),
    'dm_reason',  public.ct_dm_block_reason(me, them),
    -- Up to three, plus a total, so the row can read "Followed by A, B and
    -- 4 others" without a second query.
    'mutuals',    coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('handle', p.handle, 'name', p.name, 'avatar_url', p.avatar_url) as x
          from public.user_follows a
          join public.user_follows b on b.follower = them and b.following = a.following
          join public.user_profile p on p.user_id = a.following
         where a.follower = me and a.following <> them
         order by p.name nulls last
         limit 3
      ) t
    ), '[]'::jsonb),
    'mutuals_total', (
      select count(*) from public.user_follows a
        join public.user_follows b on b.follower = them and b.following = a.following
       where a.follower = me and a.following <> them
    )
  ) into result;
  return result;
end; $$;

grant execute on function public.profile_social(text) to anon, authenticated;

-- ── 6. The list overlays ────────────────────────────────────────────────────
create or replace function public.profile_follow_list(
  p_handle text,
  p_kind   text,               -- 'followers' | 'following'
  p_limit  int default 50,
  p_offset int default 0
)
returns table (
  handle     text,
  name       text,
  avatar_url text,
  i_follow   boolean,
  is_me      boolean
)
language sql stable security definer set search_path = public as $$
  with target as (
    select up.user_id from public.user_profile up
     where lower(up.handle) = lower(trim(p_handle))
  ),
  people as (
    select case when p_kind = 'followers' then f.follower else f.following end as uid
      from public.user_follows f, target t
     where (p_kind = 'followers' and f.following = t.user_id)
        or (p_kind = 'following' and f.follower  = t.user_id)
  )
  select p.handle, p.name, p.avatar_url,
         public.ct_follows(auth.uid(), p.user_id),
         p.user_id = auth.uid()
    from people
    join public.user_profile p on p.user_id = people.uid
   where not public.ct_blocked_between(auth.uid(), p.user_id)
   order by p.name nulls last, p.handle
   limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.profile_follow_list(text, text, int, int) to anon, authenticated;

-- ── 7. Follow / unfollow, by handle ─────────────────────────────────────────
create or replace function public.follow_user(p_handle text, p_follow boolean default true)
returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); them uuid;
begin
  if me is null then return false; end if;
  select up.user_id into them from public.user_profile up
   where lower(up.handle) = lower(trim(p_handle));
  if them is null or them = me then return false; end if;
  if public.ct_blocked_between(me, them) then return false; end if;

  if p_follow then
    insert into public.user_follows (follower, following) values (me, them)
    on conflict do nothing;
  else
    delete from public.user_follows where follower = me and following = them;
  end if;
  return true;
end; $$;
grant execute on function public.follow_user(text, boolean) to authenticated;

-- ── 8. The old vocabulary, pointed at the new graph ─────────────────────────
-- `are_friends` is read by `get_friend_schedule`, `can_see_schedule` and
-- `send_message_request`. Redefining it — rather than editing four call sites
-- — is what makes "connected" mean a mutual follow EVERYWHERE at once, which
-- is the entire point of collapsing the two relationships into one.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.ct_is_mutual(a, b);
$$;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ── 9. Who is on my people screen ───────────────────────────────────────────
-- THREE STATES, not the old four. A follow you have not returned is not a
-- "request" the way a friendship request was — nobody is waiting on your
-- permission — but it IS the one thing on this screen you might want to act
-- on, so it keeps `pending`/`incoming` and the UI says "Followed you".
--
-- `request` is new, and is the Instagram meaning: somebody you are not mutual
-- with has written to you. Those messages have existed since message requests
-- shipped and NOTHING IN THE UI EVER READ THEM — the inbox iterated accepted
-- friendships, so a stranger's one message was invisible to the person it was
-- sent to. Having a thread is now enough to appear here, which fixes that.
--
-- Following somebody who has not followed back is `following`: it is not a
-- pending anything, it lives in the Following list, and calling it a request
-- is what made two relationships feel like homework.
--
-- `friendship_id` is the counterpart's user id now. It is only ever used as a
-- key, and every action takes a handle.
create or replace function public.my_friends()
returns table (
  friendship_id uuid,
  user_id       uuid,
  handle        text,
  name          text,
  avatar_url    text,
  program       text,
  status        text,
  direction     text,
  created_at    timestamptz
)
language sql security definer set search_path = public stable as $$
  with me as (select auth.uid() as uid),
  edges as (
    select f.following as uid, true as i_follow, false as they_follow, f.created_at
      from public.user_follows f, me where f.follower = me.uid
    union all
    select f.follower, false, true, f.created_at
      from public.user_follows f, me where f.following = me.uid
  ),
  convos as (
    select case when m.sender = me.uid then m.recipient else m.sender end as uid,
           bool_or(m.sender = me.uid) as i_wrote,
           min(m.created_at) as created_at
      from public.messages m, me
     where me.uid in (m.sender, m.recipient)
     group by 1
  ),
  people as (
    select coalesce(e.uid, c.uid) as uid,
           coalesce(bool_or(e.i_follow), false)    as i_follow,
           coalesce(bool_or(e.they_follow), false) as they_follow,
           bool_or(c.uid is not null)              as has_thread,
           coalesce(bool_or(c.i_wrote), false)     as i_wrote,
           min(coalesce(e.created_at, c.created_at)) as created_at
      from edges e
      full outer join convos c on c.uid = e.uid
     group by 1
  )
  select p.uid, p.uid, up.handle, up.name, up.avatar_url, up.program,
         case
           when p.i_follow and p.they_follow then 'accepted'
           -- A thread you have taken part in is a conversation, wherever it
           -- started. Only one you have never answered is still a request.
           when p.has_thread and p.i_wrote    then 'accepted'
           when p.has_thread                  then 'request'
           when p.they_follow                 then 'pending'
           else 'following'
         end,
         case when p.they_follow and not p.i_follow then 'incoming' else 'outgoing' end,
         p.created_at
    from people p
    join public.user_profile up on up.user_id = p.uid
   where p.uid is not null
     and not public.ct_blocked_between(auth.uid(), p.uid)
   order by p.created_at desc;
$$;
grant execute on function public.my_friends() to authenticated;
revoke execute on function public.my_friends() from anon;
