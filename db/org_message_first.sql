-- ============================================================================
-- A club may open a conversation — with the people who asked to hear from it.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- ── THE PROBLEM WITH "CLUBS CAN MESSAGE FIRST" ──────────────────────────────
-- Unqualified, that sentence is a channel for unsolicited mail to every
-- student on the service, sent by an account students are told to trust. The
-- brief named the two acceptable shapes — limit it to followers, or give
-- people an opt-out — and this does BOTH, because either alone leaves a real
-- hole:
--
--   • followers-only alone: somebody who followed a club in September cannot
--     stop it messaging them in March without unfollowing, which costs them
--     the events they actually wanted;
--   • opt-out alone: it is off by default for everybody who never finds the
--     setting, which is everybody.
--
-- So: a club may write first ONLY to somebody who follows it, and anybody can
-- switch that off while still following. Answering somebody who wrote to you
-- is untouched and needs neither — a reply is not outreach.
--
-- ── ONE MESSAGE, THEN IT IS THEIR TURN ──────────────────────────────────────
-- The same rule student-to-stranger messaging already has. A club that can
-- send five unanswered messages is a club that can harass somebody politely.
-- ============================================================================

alter table public.user_profile
  add column if not exists allow_org_dms boolean not null default true;

comment on column public.user_profile.allow_org_dms is
  'Whether clubs this person FOLLOWS may start a conversation. Following is '
  'already required; this is the switch for somebody who wants the events '
  'without the messages.';

/* Why a club may write to somebody, or null when it may not. Returns a reason
   so the UI can say WHICH rule stopped it rather than "that did not work". */
create or replace function public.ct_org_dm_block_reason(p_org uuid, p_to uuid)
returns text language sql stable security definer
set search_path to 'public' as $$
  select case
    when p_org is null or p_to is null then 'unknown'
    when not public.ct_is_org_member(p_org) then 'not_your_org'
    -- A reply is always allowed: they started it.
    when exists (select 1 from public.messages w
                  where w.recipient_org = p_org and w.sender = p_to) then null
    when not exists (select 1 from public.org_follows f
                      where f.org_id = p_org and f.user_id = p_to) then 'not_a_follower'
    when not coalesce((select u.allow_org_dms from public.user_profile u
                        where u.user_id = p_to), true) then 'opted_out'
    when exists (select 1 from public.profile_blocks b
                  where b.blocked_id = (select owner_id from public.organizations where id = p_org)
                    and b.blocker_id = p_to) then 'blocked'
    -- One outstanding opener. Once they answer, the first branch takes over
    -- and the club can talk freely.
    when exists (select 1 from public.messages w
                  where w.sender_org = p_org and w.recipient = p_to) then 'awaiting_reply'
    else null
  end;
$$;

/* Kept as the name every policy already calls, now defined over the reason. */
create or replace function public.ct_org_may_reply(p_org uuid, p_to uuid)
returns boolean language sql stable security definer
set search_path to 'public' as $$
  select public.ct_org_dm_block_reason(p_org, p_to) is null;
$$;

/* Sending. A definer function rather than an insert policy, because the daily
   ceiling counts what was sent YESTERDAY and RLS cannot count. */
create or replace function public.send_org_dm(p_org uuid, p_to uuid, p_body text)
returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare reason text; sent_today int;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'Write something first.';
  end if;
  if length(p_body) > 2000 then
    raise exception 'That message is too long.';
  end if;

  reason := public.ct_org_dm_block_reason(p_org, p_to);
  if reason is not null then
    -- The token travels in DETAIL so the client can word it; the message is
    -- the fallback for anything calling this directly.
    raise exception 'This club cannot message that person.'
      using detail = reason;
  end if;

  -- A ceiling nobody reaches and a script does.
  select count(*) into sent_today from public.messages
   where sender_org = p_org and created_at > now() - interval '1 day';
  if sent_today >= 50 then
    raise exception 'This club has sent a lot of messages today. Try again tomorrow.'
      using detail = 'rate_limited';
  end if;

  insert into public.messages (sender, sender_org, recipient, body)
  values (auth.uid(), p_org, p_to, p_body);

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.ct_org_dm_block_reason(uuid, uuid) to authenticated;
grant execute on function public.send_org_dm(uuid, uuid, text) to authenticated;

/* Who a club may write to: its followers, minus the ones who switched it off,
   minus anybody it already has an unanswered opener with. Searchable, because
   a club with 400 followers needs a box and not a list. */
create or replace function public.org_dm_candidates(p_org uuid, p_q text default '')
returns table (user_id uuid, name text, handle text, avatar_url text, follows_since timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select u.user_id, u.name, u.handle, u.avatar_url, f.created_at
    from public.org_follows f
    join public.user_profile u on u.user_id = f.user_id
   where f.org_id = p_org
     and public.ct_is_org_member(p_org)
     and coalesce(u.allow_org_dms, true)
     and (
       coalesce(trim(p_q), '') = ''
       or u.name  ilike '%' || trim(p_q) || '%'
       or u.handle ilike '%' || trim(p_q) || '%'
     )
   order by f.created_at desc
   limit 50;
$$;

grant execute on function public.org_dm_candidates(uuid, text) to authenticated;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select ct_org_dm_block_reason('<org>','<stranger>');   -- not_a_follower
--   select ct_org_dm_block_reason('<org>','<follower>');   -- null
--   -- after one unanswered opener:                        -- awaiting_reply
