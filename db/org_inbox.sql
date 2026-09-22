-- A club has an inbox.
--
-- WHY THIS EXISTS. Story replies were routed to whoever OWNS the club, because
-- `messages` only knew how to address a person. That is wrong in two ways: the
-- student thinks they are writing to the club and their message lands in one
-- individual's DMs, and when that person graduates the club's conversations
-- leave with them. A club is an account here — it publishes, it is followed, it
-- is verified — so it can be written to.
--
-- ONE MESSAGE TABLE, NOT TWO. A parallel `org_messages` would mean two inboxes,
-- two unread counts, two sets of attachment handling, and two places for the
-- rules about who may write to whom to drift apart. Instead `messages` learns
-- that either end can be an organisation.
--
-- `sender` STAYS NOT NULL AND STAYS A PERSON. It is who pressed send, always,
-- and it is never shown when `sender_org` is set — the message renders as the
-- club. That split is deliberate: the club is the identity, and the human is
-- the audit trail. A shared mailbox where nobody can tell who answered is how
-- a volunteer organisation ends up unable to resolve a complaint.
--
-- READING IT DOES NOT NEED APPROVAL. `ct_can_act_as_org` gates PUBLISHING and
-- requires an approved org. Answering somebody who wrote to you is not
-- publishing, so the inbox uses `ct_is_org_member` — owner or active member.
-- An unapproved org is invisible in Community anyway, so nothing can reach it.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

-- ── 1. Either end can be an organisation ────────────────────────────────────
alter table public.messages
  add column if not exists sender_org    uuid references public.organizations (id) on delete cascade,
  add column if not exists recipient_org uuid references public.organizations (id) on delete cascade;

alter table public.messages alter column recipient drop not null;

do $$ begin
  -- Exactly one recipient. Every existing row has `recipient` set and
  -- `recipient_org` null, so this holds on the way in.
  alter table public.messages
    add constraint messages_one_recipient_ck
    check ((recipient is null) <> (recipient_org is null));
exception when duplicate_object then null; end $$;

create index if not exists messages_org_inbox_idx
  on public.messages (recipient_org, created_at desc) where recipient_org is not null;
create index if not exists messages_org_outbox_idx
  on public.messages (sender_org, created_at desc) where sender_org is not null;

comment on column public.messages.sender_org is
  'Set when this was sent AS an organisation. `sender` is still the human who pressed send, and is never displayed in that case.';

-- ── 2. Who can open a club's inbox ──────────────────────────────────────────
create or replace function public.ct_is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and (
    exists (select 1 from public.organizations o
             where o.id = p_org and o.owner_id = auth.uid())
    or exists (select 1 from public.org_members m
                where m.org_id = p_org and m.user_id = auth.uid()
                  and coalesce(m.status, 'active') = 'active')
    or public.is_admin()
  );
$$;
grant execute on function public.ct_is_org_member(uuid) to authenticated;

-- ── 3. May I write to this club? ────────────────────────────────────────────
-- The user→org rules are DELIBERATELY DIFFERENT from user→user, because the
-- risk is different. A stranger writing to a person is the shape that becomes
-- harassment, so that path allows one message and no links. A club is a public
-- account that exists to be contacted, and a legitimate message to one often
-- carries a link — a portfolio, a form, a sponsorship deck. So: no one-message
-- limit and no link rule, but a daily ceiling that a person will never reach
-- and a script will.
create or replace function public.ct_org_dm_block_reason(p_from uuid, p_org uuid, p_body text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare sent int;
begin
  if p_from is null or p_org is null then return 'auth'; end if;

  if not exists (
    select 1 from public.organizations o
     where o.id = p_org and coalesce(o.status, 'pending') = 'approved'
  ) then
    return 'closed';
  end if;

  -- Your own club's inbox is not a conversation with yourself.
  if public.ct_is_org_member(p_org) then return 'self'; end if;

  if p_body is not null and length(p_body) > 2000 then return 'too-long'; end if;

  select count(*) into sent
    from public.messages m
   where m.sender = p_from and m.recipient_org is not null
     and m.created_at > now() - interval '24 hours';
  if sent >= 20 then return 'rate'; end if;

  return null;
end; $$;
grant execute on function public.ct_org_dm_block_reason(uuid, uuid, text) to authenticated;

-- ── 4. May a club reply to this person? ─────────────────────────────────────
-- A HELPER, not an inline subquery in the policy. Inside `select 1 from
-- public.messages w`, an unqualified `recipient` resolves to `w.recipient`,
-- not to the row being inserted — the kind of silent misbinding that makes a
-- gate pass everything. Passing both ids in leaves nothing to resolve.
create or replace function public.ct_org_may_reply(p_org uuid, p_to uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and p_to is not null
     and public.ct_is_org_member(p_org)
     -- They wrote first. Without this a club is a channel for unsolicited
     -- mail to any student on the service.
     and exists (
       select 1 from public.messages w
        where w.recipient_org = p_org and w.sender = p_to
     );
$$;
grant execute on function public.ct_org_may_reply(uuid, uuid) to authenticated;

-- ── 5. The policies ─────────────────────────────────────────────────────────
drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
  for select to authenticated
  using (
    auth.uid() = sender
    or auth.uid() = recipient
    or (recipient_org is not null and public.ct_is_org_member(recipient_org))
    or (sender_org    is not null and public.ct_is_org_member(sender_org))
  );

drop policy if exists messages_insert_allowed on public.messages;
create policy messages_insert_allowed on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender
    and (
      -- Writing to a club.
      (recipient_org is not null
        and sender_org is null
        and public.ct_org_dm_block_reason(auth.uid(), recipient_org, body) is null)
      -- A club answering somebody who wrote to it first.
      or (sender_org is not null
        and recipient is not null
        and public.ct_org_may_reply(sender_org, recipient))
      -- Person to person, unchanged.
      or (recipient is not null
        and sender_org is null
        and public.ct_dm_block_reason(auth.uid(), recipient, body) is null)
    )
  );

drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages
  for update to authenticated
  using (
    auth.uid() = recipient
    or (recipient_org is not null and public.ct_is_org_member(recipient_org))
  )
  with check (
    auth.uid() = recipient
    or (recipient_org is not null and public.ct_is_org_member(recipient_org))
  );

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
  for delete to authenticated
  using (
    auth.uid() = sender
    or auth.uid() = recipient
    or (recipient_org is not null and public.ct_is_org_member(recipient_org))
  );

-- A message sent AS a club is never a "request" — the student wrote first, and
-- the flag exists to mark a cold first contact.
create or replace function public.ct_stamp_request()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender_org is not null or new.recipient_org is not null then
    new.is_request := false;
  else
    new.is_request := not public.ct_is_mutual(new.sender, new.recipient);
  end if;
  return new;
end; $$;

-- ── 6. The thread list, now that a counterpart can be a club ────────────────
-- The return type gains columns, so it is DROPPED first: `create or replace`
-- cannot widen one, and the client reads these positionally.
--
-- It also now carries the counterpart's NAME, HANDLE and AVATAR. That is not
-- convenience — the message list used to be assembled from `my_friends`, which
-- is the follow graph between PEOPLE and can never contain a club. The thread
-- list is the right source for an inbox, and it is only the right source if it
-- can render itself.
drop function if exists public.my_threads();

create function public.my_threads()
returns table (
  other            uuid,
  other_kind       text,      -- 'user' | 'org'
  other_handle     text,
  other_name       text,
  other_avatar     text,
  last_body        text,
  last_attachment  jsonb,
  last_sender      uuid,
  last_from_me     boolean,
  last_at          timestamptz,
  unread           integer
)
language sql stable security definer set search_path = public as $$
  with mine as (
    -- STRICTLY the messages I am personally an end of. A message to a club I
    -- help run reaches me through the portal's inbox; surfacing it here too
    -- would put my own club in my personal DM list and count its unread twice.
    select m.*,
           case
             when m.sender = auth.uid() then coalesce(m.recipient_org, m.recipient)
             else coalesce(m.sender_org, m.sender)
           end as cp,
           case
             when m.recipient_org is not null or m.sender_org is not null then 'org'
             else 'user'
           end as cp_kind,
           (m.sender = auth.uid()) as from_me
      from public.messages m
     where (auth.uid() = m.sender and m.sender_org is null)
        or auth.uid() = m.recipient
  ),
  newest as (
    select distinct on (cp) cp, cp_kind, body, attachment, sender, from_me, created_at
      from mine
     order by cp, created_at desc
  ),
  unread_counts as (
    -- Only messages addressed to ME personally can be unread by me.
    select cp, count(*)::integer as n
      from mine
     where read_at is null and recipient = auth.uid()
     group by cp
  )
  select n.cp,
         n.cp_kind,
         case when n.cp_kind = 'org' then o.handle else up.handle end,
         case when n.cp_kind = 'org' then o.name   else up.name   end,
         case when n.cp_kind = 'org' then o.logo   else up.avatar_url end,
         n.body, n.attachment, n.sender, n.from_me, n.created_at,
         coalesce(u.n, 0)
    from newest n
    left join unread_counts u  on u.cp = n.cp
    left join public.user_profile  up on n.cp_kind = 'user' and up.user_id = n.cp
    left join public.organizations o  on n.cp_kind = 'org'  and o.id       = n.cp
   order by n.created_at desc;
$$;
grant execute on function public.my_threads() to authenticated;

-- ── 7. One club's inbox, for the portal ─────────────────────────────────────
create or replace function public.org_threads(p_org uuid)
returns table (
  other        uuid,
  other_handle text,
  other_name   text,
  other_avatar text,
  last_body    text,
  last_sender  uuid,
  last_from_org boolean,
  last_at      timestamptz,
  unread       integer
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.*,
           case when m.sender_org = p_org then m.recipient else m.sender end as cp
      from public.messages m
     where public.ct_is_org_member(p_org)
       and (m.recipient_org = p_org or m.sender_org = p_org)
  ),
  newest as (
    select distinct on (cp) cp, body, sender, created_at, sender_org
      from mine order by cp, created_at desc
  ),
  unread_counts as (
    select cp, count(*)::integer as n from mine
     where recipient_org = p_org and read_at is null group by cp
  )
  select n.cp, up.handle, up.name, up.avatar_url,
         n.body, n.sender, n.sender_org is not null, n.created_at,
         coalesce(u.n, 0)
    from newest n
    left join unread_counts u on u.cp = n.cp
    left join public.user_profile up on up.user_id = n.cp
   order by n.created_at desc;
$$;
grant execute on function public.org_threads(uuid) to authenticated;

/** One conversation between a club and one person, oldest first. */
create or replace function public.org_thread_messages(p_org uuid, p_other uuid, p_limit int default 200)
returns table (
  id          uuid,
  body        text,
  attachment  jsonb,
  from_org    boolean,
  sender      uuid,
  sender_name text,
  created_at  timestamptz,
  read_at     timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.body, m.attachment, m.sender_org is not null, m.sender,
         -- Who on the team answered. Shown to the TEAM only (this function is
         -- reachable only by a member) — the student sees the club.
         up.name,
         m.created_at, m.read_at
    from public.messages m
    left join public.user_profile up on up.user_id = m.sender
   where public.ct_is_org_member(p_org)
     and ((m.recipient_org = p_org and m.sender = p_other)
       or (m.sender_org    = p_org and m.recipient = p_other))
   order by m.created_at
   limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;
grant execute on function public.org_thread_messages(uuid, uuid, int) to authenticated;

create or replace function public.mark_org_thread_read(p_org uuid, p_other uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.ct_is_org_member(p_org) then return 0; end if;
  update public.messages
     set read_at = now()
   where recipient_org = p_org and sender = p_other and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.mark_org_thread_read(uuid, uuid) to authenticated;

/** Unread across every club this person helps run — for the portal's badge. */
create or replace function public.my_org_unread()
returns table (org_id uuid, unread integer)
language sql stable security definer set search_path = public as $$
  select m.recipient_org, count(*)::integer
    from public.messages m
   where m.recipient_org is not null
     and m.read_at is null
     and public.ct_is_org_member(m.recipient_org)
   group by m.recipient_org;
$$;
grant execute on function public.my_org_unread() to authenticated;

-- ── 8. Reading a club thread from the STUDENT side ──────────────────────────
-- The client's `listMessages` filters on sender/recipient uuids and cannot
-- express "…or addressed to this org", so the org direction gets its own read.
create or replace function public.my_thread_with_org(p_org uuid, p_limit int default 200)
returns table (
  id         uuid,
  body       text,
  attachment jsonb,
  from_org   boolean,
  created_at timestamptz,
  read_at    timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.body, m.attachment, m.sender_org is not null, m.created_at, m.read_at
    from public.messages m
   where (m.recipient_org = p_org and m.sender = auth.uid())
      or (m.sender_org    = p_org and m.recipient = auth.uid())
   order by m.created_at
   limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;
grant execute on function public.my_thread_with_org(uuid, int) to authenticated;

-- ── 9. A club conversation is not also a conversation with its owner ────────
-- `my_friends` groups messages by "the other end", and it predates org
-- addressing — so a reply sent AS a club counted as a personal thread with
-- whichever member typed it, and the student's inbox listed the club AND that
-- person for the same exchange. The fix belongs here rather than in
-- social_follow_model.sql: it is the file that introduces the columns, so
-- neither file depends on the other having run.
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
       -- PERSON-TO-PERSON ONLY. Anything with a club at either end belongs to
       -- the club's thread, which `my_threads` returns separately.
       and m.sender_org is null
       and m.recipient_org is null
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
