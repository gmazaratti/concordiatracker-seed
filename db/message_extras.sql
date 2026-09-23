-- ============================================================================
-- Replies, reactions and read receipts for direct messages — and a hole
-- closed on the way.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- `messages_mark_read` is an UPDATE policy whose check is "you are the
-- recipient". It exists so the recipient can set `read_at`, but a policy
-- cannot name columns — so the recipient could rewrite the BODY of a message
-- somebody else sent them, and the thread would show the sender saying words
-- they never wrote. Every legitimate update in the product (markRead,
-- `mark_org_thread_read`, `mark_thread_read`) touches `read_at` and nothing
-- else, so a trigger can be strict: through the API, an update may change
-- `read_at` and nothing more.
--
-- ── REPLIES ─────────────────────────────────────────────────────────────────
-- `reply_to` points at the quoted message. `on delete set null`, because a
-- reply to a message that was deleted is still a message; it just quotes
-- nothing.
--
-- ── REACTIONS ───────────────────────────────────────────────────────────────
-- One per person per message (the primary key), from a FIXED set. A free
-- text column would be a second, unmoderated message channel attached to
-- every message. Written only through `react_message`, which checks you are
-- one end of the conversation; the same emoji twice takes it off.
--
-- ── READ RECEIPTS ───────────────────────────────────────────────────────────
-- Per conversation, on by default, and RECIPROCAL: they show only when BOTH
-- people have them on. Turning yours off means you see nobody's in that
-- chat, which is the trade that stops it being a one-way surveillance tool.
-- `thread_receipts` returns read times for messages YOU sent, and only when
-- both are on.
-- HONEST LIMIT, written down so it is not mistaken for more: `read_at` is
-- still a column on a row the sender can SELECT, because the recipient's own
-- unread counts are computed from it. Anybody reading the raw API as the
-- sender can still see it. Closing that needs column privileges on
-- `messages` and every read of that table moved behind a function.
-- ============================================================================

-- ── The guard ───────────────────────────────────────────────────────────────
create or replace function public.ct_guard_message_update()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.body        is distinct from old.body
    or new.attachment  is distinct from old.attachment
    or new.sender      is distinct from old.sender
    or new.recipient   is distinct from old.recipient
    or new.sender_org  is distinct from old.sender_org
    or new.recipient_org is distinct from old.recipient_org
    or new.created_at  is distinct from old.created_at
    or new.is_request  is distinct from old.is_request then
      raise exception 'A message cannot be edited.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_message_update on public.messages;
create trigger trg_guard_message_update
  before update on public.messages
  for each row execute function public.ct_guard_message_update();

-- ── Replies ─────────────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists reply_to uuid references public.messages(id) on delete set null;

-- A reply cannot quote a message from a different conversation: that would
-- let you drag somebody else's words into a chat they are not in.
create or replace function public.ct_check_reply_to()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare q public.messages;
begin
  if new.reply_to is null then return new; end if;
  select * into q from public.messages where id = new.reply_to;
  if not found then
    new.reply_to := null;
    return new;
  end if;
  if not (
    (q.sender = new.sender and q.recipient = new.recipient)
    or (q.sender = new.recipient and q.recipient = new.sender)
  ) then
    raise exception 'You can only reply to a message in this conversation.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_check_reply_to on public.messages;
create trigger trg_check_reply_to
  before insert on public.messages
  for each row execute function public.ct_check_reply_to();

-- ── Reactions ───────────────────────────────────────────────────────────────
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reactions enable row level security;

drop policy if exists "message_reactions_read" on public.message_reactions;
create policy "message_reactions_read" on public.message_reactions for select using (
  exists (select 1 from public.messages m
           where m.id = message_reactions.message_id
             and (m.sender = auth.uid() or m.recipient = auth.uid()))
);
-- No insert/update/delete policies: `react_message` is the only writer.

create or replace function public.ct_reaction_set()
returns text[]
language sql
immutable
as $$ select array['❤️', '😂', '😮', '😢', '🔥', '👍', '👏', '🙏'] $$;

create or replace function public.react_message(p_message uuid, p_emoji text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  current_emoji text;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.messages m
     where m.id = p_message
       and (m.sender = me or m.recipient = me)
       and m.sender_org is null and m.recipient_org is null
  ) then
    raise exception 'You can only react to messages in your own conversations.' using errcode = '42501';
  end if;

  select emoji into current_emoji from public.message_reactions
   where message_id = p_message and user_id = me;

  -- Empty, or the same one again: take it off.
  if coalesce(trim(p_emoji), '') = '' or current_emoji = p_emoji then
    delete from public.message_reactions where message_id = p_message and user_id = me;
    return null;
  end if;

  if not (p_emoji = any(public.ct_reaction_set())) then
    raise exception 'That reaction is not available.' using errcode = '22023';
  end if;

  insert into public.message_reactions (message_id, user_id, emoji)
  values (p_message, me, p_emoji)
  on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  return p_emoji;
end $$;
grant execute on function public.react_message(uuid, text) to authenticated;

-- ── Read receipts ───────────────────────────────────────────────────────────
create table if not exists public.dm_prefs (
  user_id       uuid not null references auth.users(id) on delete cascade,
  other_id      uuid not null references auth.users(id) on delete cascade,
  read_receipts boolean not null default true,
  updated_at    timestamptz not null default now(),
  primary key (user_id, other_id)
);
alter table public.dm_prefs enable row level security;
drop policy if exists "dm_prefs_own" on public.dm_prefs;
create policy "dm_prefs_own" on public.dm_prefs for select using (user_id = auth.uid());

create or replace function public.set_dm_receipts(p_other uuid, p_on boolean)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.dm_prefs (user_id, other_id, read_receipts)
  select auth.uid(), p_other, coalesce(p_on, true)
   where auth.uid() is not null
  on conflict (user_id, other_id) do update
     set read_receipts = excluded.read_receipts, updated_at = now();
$$;
grant execute on function public.set_dm_receipts(uuid, boolean) to authenticated;

-- `mine` = your own switch for this chat; `shared` = both of you have it on,
-- which is the only state in which anything is shown.
create or replace function public.dm_receipts_state(p_other uuid)
returns table (mine boolean, shared boolean)
language sql
stable security definer
set search_path to 'public'
as $$
  with m as (
    select coalesce((select read_receipts from public.dm_prefs
                      where user_id = auth.uid() and other_id = p_other), true) as mine,
           coalesce((select read_receipts from public.dm_prefs
                      where user_id = p_other and other_id = auth.uid()), true) as theirs
  )
  select m.mine, m.mine and m.theirs from m;
$$;
grant execute on function public.dm_receipts_state(uuid) to authenticated;

create or replace function public.thread_receipts(p_other uuid)
returns table (message_id uuid, read_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $$
  select m.id, m.read_at
    from public.messages m
   where m.sender = auth.uid()
     and m.recipient = p_other
     and m.read_at is not null
     and (select shared from public.dm_receipts_state(p_other))
   order by m.created_at desc
   limit 300;
$$;
grant execute on function public.thread_receipts(uuid) to authenticated;
