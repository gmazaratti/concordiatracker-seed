-- ============================================================================
-- A note from the founder, on one person's screen.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- WHY THIS IS NOT A NOTIFICATION. A notification is a thing you can ignore
-- forever and most people do. The point here is to reach one specific student
-- who is using the app right now -- "I saw your ticket, I just fixed it" --
-- and to find out whether that landed. So:
--
--   IT STAYS UNTIL ACKNOWLEDGED. There is no dismiss. One button, and
--   pressing it is what records that they read it.
--   THEY CAN ANSWER. A message you cannot reply to is an announcement, and an
--   announcement does not need a person's name on it.
--
-- WHY NOT THE EXISTING DM TABLE. `messages` is student-to-student, gated on
-- an accepted friendship, and it renders inside Community where nobody is
-- looking. This is a different thing with different rules: one direction,
-- admin-only to send, and it interrupts on purpose.
--
-- THE RESTRAINT, written down so it survives: this is for a REPLY TO SOMETHING
-- THEY DID. It is not a broadcast channel, there is deliberately no "send to
-- everyone", and every send is written to the audit log with the body -- so
-- using it as a marketing megaphone leaves a permanent, readable trail.
-- ============================================================================

create table if not exists public.admin_messages (
  id              bigserial primary key,
  recipient       uuid not null references auth.users (id) on delete cascade,
  sender          uuid,
  sender_name     text not null default 'ConcordiaTracker',
  body            text not null,
  created_at      timestamptz not null default now(),
  -- Rendered on their screen. Distinct from acknowledged: seeing a toast and
  -- reading it are not the same event, and the difference is worth keeping.
  seen_at         timestamptz,
  acknowledged_at timestamptz,
  reply           text,
  replied_at      timestamptz
);

create index if not exists admin_messages_recipient_idx
  on public.admin_messages (recipient, acknowledged_at, created_at desc);

alter table public.admin_messages enable row level security;

-- Read your own; admins read everything. No insert/update policy at all —
-- every write goes through a function, so a client cannot forge a sender,
-- mark someone else's message read, or write a reply as somebody else.
drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
  for select using (auth.uid() = recipient or public.is_admin());

-- ── Sending ─────────────────────────────────────────────────────────────────
create or replace function public.send_admin_message(p_to uuid, p_body text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_name text;
begin
  if not public.is_admin() then raise exception 'Not authorized.'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'Write something first.'; end if;
  if length(p_body) > 1000 then raise exception 'Keep it under 1000 characters.'; end if;

  select coalesce(p.name, 'ConcordiaTracker') into v_name
    from public.user_profile p where p.user_id = auth.uid();

  insert into public.admin_messages (recipient, sender, sender_name, body)
  values (p_to, auth.uid(), coalesce(v_name, 'ConcordiaTracker'), trim(p_body))
  returning id into v_id;

  -- The BODY goes in the audit log, not just the fact of a send. A channel
  -- that can interrupt any student needs its contents on the record.
  perform public.log_admin_action(
    'message.send', p_to, left(trim(p_body), 500),
    null, jsonb_build_object('message_id', v_id)
  );
  return v_id;
end $$;
grant execute on function public.send_admin_message(uuid, text) to authenticated;

-- ── Receiving ───────────────────────────────────────────────────────────────
-- Only what is still waiting. Once acknowledged it never comes back.
create or replace function public.my_admin_messages()
returns table (id bigint, sender_name text, body text, created_at timestamptz)
language sql security definer set search_path = public volatile as $$
  with pending as (
    select m.id, m.sender_name, m.body, m.created_at
      from public.admin_messages m
     where m.recipient = auth.uid() and m.acknowledged_at is null
     order by m.created_at
     limit 3
  ),
  -- Stamped on first read, so "delivered but ignored" is distinguishable from
  -- "never opened the app". Done here rather than in a second round trip the
  -- client could skip.
  mark as (
    update public.admin_messages m set seen_at = now()
     where m.id in (select id from pending) and m.seen_at is null
  )
  select * from pending;
$$;
grant execute on function public.my_admin_messages() to authenticated;

-- One button. Pressing it is the acknowledgement; the reply is optional.
create or replace function public.ack_admin_message(p_id bigint, p_reply text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.admin_messages m
     set acknowledged_at = now(),
         reply = case when coalesce(trim(p_reply), '') = '' then m.reply else left(trim(p_reply), 1000) end,
         replied_at = case when coalesce(trim(p_reply), '') = '' then m.replied_at else now() end
   where m.id = p_id
     -- Only your own. Without this, an id is enough to read someone's mail.
     and m.recipient = auth.uid();
  if not found then raise exception 'That message is not yours.'; end if;
end $$;
grant execute on function public.ack_admin_message(bigint, text) to authenticated;

-- ── The admin's side ────────────────────────────────────────────────────────
create or replace function public.admin_messages_for(p_user uuid)
returns table (
  id bigint, body text, created_at timestamptz, seen_at timestamptz,
  acknowledged_at timestamptz, reply text, replied_at timestamptz, sender_name text
)
language sql security definer set search_path = public stable as $$
  select m.id, m.body, m.created_at, m.seen_at, m.acknowledged_at,
         m.reply, m.replied_at, m.sender_name
    from public.admin_messages m
   where public.is_admin() and m.recipient = p_user
   order by m.created_at desc
   limit 50;
$$;
grant execute on function public.admin_messages_for(uuid) to authenticated;

-- Replies you have not read yet, across everyone — the inbox side of this.
create or replace function public.admin_message_replies(p_limit int default 30)
returns table (
  id bigint, recipient uuid, who text, body text, reply text, replied_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select m.id, m.recipient,
         coalesce(p.name, p.email, 'Unnamed'), m.body, m.reply, m.replied_at
    from public.admin_messages m
    left join public.user_profile p on p.user_id = m.recipient
   where public.is_admin() and m.reply is not null
   order by m.replied_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 200));
$$;
grant execute on function public.admin_message_replies(int) to authenticated;

-- ── Who is online right now ─────────────────────────────────────────────────
-- A "session" here is the last five minutes of events. Anyone whose last
-- event is older than that has gone, whatever their tab says.
create or replace function public.admin_online_now(p_minutes int default 5)
returns table (
  user_id    uuid,
  name       text,
  email      text,
  path       text,
  last_seen  timestamptz,
  -- How long THIS visit has run, not how long they have existed.
  seconds    int,
  device     text,
  is_internal boolean
)
language sql security definer set search_path = public stable as $$
  with win as (
    select e.*, max(e.created_at) over (partition by e.session_id) as sess_end
      from public.site_events e
     where e.created_at > now() - make_interval(mins => greatest(1, least(coalesce(p_minutes, 5), 120)))
       and e.user_id is not null
  ),
  per_user as (
    select distinct on (w.user_id)
           w.user_id, w.session_id, w.path, w.created_at, w.device
      from win w
     order by w.user_id, w.created_at desc
  )
  select u.user_id,
         coalesce(p.name, 'Unnamed'),
         p.email,
         u.path,
         u.created_at,
         -- Measured over the whole session, not just the visible window, so a
         -- long visit does not reset to zero every five minutes.
         greatest(0, extract(epoch from (
           u.created_at - (select min(e2.created_at) from public.site_events e2
                            where e2.session_id = u.session_id)
         ))::int),
         u.device,
         coalesce(p.is_internal, false)
    from per_user u
    left join public.user_profile p on p.user_id = u.user_id
   where public.is_admin()
   order by u.created_at desc;
$$;
grant execute on function public.admin_online_now(int) to authenticated;

-- Check:
--   select public.send_admin_message('<uuid>', 'Hello');
--   select * from public.my_admin_messages();
--   select * from public.admin_online_now(5);
