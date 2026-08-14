-- ============================================================================
-- Support tickets — a threaded conversation between a person and support.
-- RUN IN: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- Two entry points, and the difference drives the whole design:
--   • Signed in (the app)  → ticket is tied to user_id, appears in their list.
--   • Signed out (the docs) → there is no auth at all, so the ticket is keyed
--     by a random lookup token returned once at submit time. Same model as the
--     existing teacher/organizer access requests: you get a case number back
--     and can check status with it.
--
-- Anonymous submissions never touch these tables directly. They go through
-- /api/ticket with the service role, which is where rate limiting lives — an
-- open insert policy for `anon` would be a spam faucet.
-- ============================================================================

-- Human-facing case numbers. Starting at 1001 so the first ticket doesn't look
-- like the first ticket.
create sequence if not exists public.ticket_case_seq start 1001;

create table if not exists public.tickets (
  id                uuid primary key default gen_random_uuid(),
  case_id           text unique not null default 'TKT-' || nextval('public.ticket_case_seq'),
  -- Null for a signed-out submission. Set on the app path.
  user_id           uuid references auth.users (id) on delete set null,
  -- Always captured: it's the only way to reply to an anonymous reporter.
  email             text not null,
  name              text,
  subject           text not null,
  category          text not null default 'other',   -- billing|bug|account|feature|other
  status            text not null default 'open',    -- open|answered|solved
  source            text not null default 'app',     -- app|docs
  -- Page, browser, app version — whatever the client knew at submit time.
  -- Saves a round trip of "which page were you on?".
  context           jsonb not null default '{}'::jsonb,
  -- Unguessable handle for signed-out status lookup. Never exposed to a list.
  lookup_token      text not null default encode(gen_random_bytes(18), 'hex'),
  created_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  -- When the requester last opened the thread → drives the "new reply" badge.
  user_seen_at      timestamptz,
  constraint ticket_status_valid check (status in ('open', 'answered', 'solved')),
  constraint ticket_source_valid check (source in ('app', 'docs')),
  constraint ticket_subject_len check (char_length(subject) between 3 and 200)
);

create index if not exists tickets_user_idx on public.tickets (user_id, last_activity_at desc);
create index if not exists tickets_status_idx on public.tickets (status, last_activity_at desc);

create table if not exists public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  -- Null when support replied, or when the sender was signed out.
  author_id   uuid references auth.users (id) on delete set null,
  author_role text not null,                        -- user|staff
  author_name text not null default 'Support',
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint msg_role_valid check (author_role in ('user', 'staff')),
  constraint msg_body_len check (char_length(body) between 1 and 5000)
);

create index if not exists ticket_messages_thread_idx
  on public.ticket_messages (ticket_id, created_at);

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- Read your own; admins read everything. There are deliberately NO insert or
-- update policies — every write goes through a SECURITY DEFINER function below,
-- so status, case_id, author_role and lookup_token can't be forged by a crafted
-- request. Anonymous rows (user_id is null) are unreadable through RLS entirely;
-- they're only reachable via the token lookup, with the service role.
drop policy if exists "tickets_select" on public.tickets;
create policy "tickets_select" on public.tickets
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "ticket_messages_select" on public.ticket_messages;
create policy "ticket_messages_select" on public.ticket_messages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.tickets t
       where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

grant select on public.tickets to authenticated;
grant select on public.ticket_messages to authenticated;

-- ── Submit ───────────────────────────────────────────────────────────────────
-- Callable by a signed-in user for themselves, and by the service role (with an
-- explicit email) for the signed-out docs form.
create or replace function public.submit_ticket(
  p_subject  text,
  p_body     text,
  p_category text default 'other',
  p_email    text default null,
  p_name     text default null,
  p_source   text default 'app',
  p_context  jsonb default '{}'::jsonb
)
returns table (case_id text, lookup_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_name  text;
  v_id    uuid;
begin
  if char_length(coalesce(trim(p_subject), '')) < 3 then
    raise exception 'Please give the ticket a subject.';
  end if;
  if char_length(coalesce(trim(p_body), '')) < 10 then
    raise exception 'Please describe the problem in a little more detail.';
  end if;

  if v_uid is not null then
    select u.email into v_email from auth.users u where u.id = v_uid;
    select p.name  into v_name  from public.user_profile p where p.user_id = v_uid;
  end if;
  v_email := coalesce(v_email, nullif(trim(p_email), ''));
  v_name  := coalesce(v_name, nullif(trim(p_name), ''));

  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required so we can reply.';
  end if;

  insert into public.tickets (user_id, email, name, subject, category, source, context)
  values (
    v_uid, lower(v_email), v_name, trim(p_subject),
    case when p_category in ('billing','bug','account','feature','other') then p_category else 'other' end,
    case when p_source in ('app','docs') then p_source else 'app' end,
    coalesce(p_context, '{}'::jsonb)
  )
  returning id into v_id;

  insert into public.ticket_messages (ticket_id, author_id, author_role, author_name, body)
  values (v_id, v_uid, 'user', coalesce(v_name, 'You'), trim(p_body));

  return query
    select t.case_id, t.lookup_token from public.tickets t where t.id = v_id;
end $$;

grant execute on function public.submit_ticket(text, text, text, text, text, text, jsonb)
  to authenticated, service_role;

-- ── Reply ────────────────────────────────────────────────────────────────────
-- One function for both sides. The role is DERIVED from is_admin(), never taken
-- from the caller, so a user can't post a message that renders as support.
create or replace function public.reply_ticket(p_ticket_id uuid, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_admin  boolean := public.is_admin();
  v_owner  uuid;
  v_name   text;
begin
  if v_uid is null then raise exception 'Sign in to reply.'; end if;
  if char_length(coalesce(trim(p_body), '')) < 1 then raise exception 'Message is empty.'; end if;

  select user_id into v_owner from public.tickets where id = p_ticket_id;
  if not found then raise exception 'That ticket does not exist.'; end if;
  if not v_admin and v_owner is distinct from v_uid then
    raise exception 'That is not your ticket.';
  end if;

  if v_admin then
    v_name := 'Support';
  else
    select coalesce(p.name, 'You') into v_name from public.user_profile p where p.user_id = v_uid;
  end if;

  insert into public.ticket_messages (ticket_id, author_id, author_role, author_name, body)
  values (p_ticket_id, v_uid, case when v_admin then 'staff' else 'user' end, coalesce(v_name, 'You'), trim(p_body));

  -- A staff reply moves it to "answered"; a user reply reopens it. A solved
  -- ticket the user writes back on becomes open again rather than staying shut.
  update public.tickets
     set status = case when v_admin then 'answered' else 'open' end,
         last_activity_at = now(),
         user_seen_at = case when v_admin then user_seen_at else now() end
   where id = p_ticket_id;
end $$;

grant execute on function public.reply_ticket(uuid, text) to authenticated;

-- ── Read ─────────────────────────────────────────────────────────────────────
create or replace function public.my_tickets()
returns table (
  id uuid, case_id text, subject text, category text, status text,
  created_at timestamptz, last_activity_at timestamptz, has_unread boolean
)
language sql security definer set search_path = public stable as $$
  select t.id, t.case_id, t.subject, t.category, t.status, t.created_at, t.last_activity_at,
         exists (
           select 1 from public.ticket_messages m
            where m.ticket_id = t.id
              and m.author_role = 'staff'
              and (t.user_seen_at is null or m.created_at > t.user_seen_at)
         )
  from public.tickets t
  where t.user_id = auth.uid()
  order by t.last_activity_at desc;
$$;
grant execute on function public.my_tickets() to authenticated;

create or replace function public.ticket_thread(p_ticket_id uuid)
returns table (id uuid, author_role text, author_name text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.tickets where id = p_ticket_id;
  if not found then raise exception 'That ticket does not exist.'; end if;
  if not public.is_admin() and v_owner is distinct from auth.uid() then
    raise exception 'That is not your ticket.';
  end if;

  -- Opening your own thread clears the unread badge.
  if v_owner = auth.uid() then
    update public.tickets set user_seen_at = now() where id = p_ticket_id;
  end if;

  return query
    select m.id, m.author_role, m.author_name, m.body, m.created_at
    from public.ticket_messages m
    where m.ticket_id = p_ticket_id
    order by m.created_at;
end $$;
grant execute on function public.ticket_thread(uuid) to authenticated;

-- ── Admin ────────────────────────────────────────────────────────────────────
create or replace function public.admin_tickets(p_status text default null, p_q text default null)
returns table (
  id uuid, case_id text, subject text, category text, status text, source text,
  email text, name text, user_id uuid, created_at timestamptz,
  last_activity_at timestamptz, message_count int, awaiting_reply boolean
)
language sql security definer set search_path = public stable as $$
  select t.id, t.case_id, t.subject, t.category, t.status, t.source,
         t.email, t.name, t.user_id, t.created_at, t.last_activity_at,
         (select count(*)::int from public.ticket_messages m where m.ticket_id = t.id),
         t.status = 'open'
  from public.tickets t
  where public.is_admin()
    and (p_status is null or t.status = p_status)
    and (
      p_q is null or trim(p_q) = '' or
      t.case_id ilike '%' || trim(p_q) || '%' or
      t.subject ilike '%' || trim(p_q) || '%' or
      t.email   ilike '%' || trim(p_q) || '%' or
      coalesce(t.name, '') ilike '%' || trim(p_q) || '%'
    )
  -- Open first, then most recently active: the queue reads as work to do.
  order by (t.status = 'open') desc, t.last_activity_at desc
  limit 200;
$$;
grant execute on function public.admin_tickets(text, text) to authenticated;

create or replace function public.set_ticket_status(p_ticket_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorized.'; end if;
  if p_status not in ('open', 'answered', 'solved') then raise exception 'Unknown status.'; end if;
  update public.tickets
     set status = p_status, last_activity_at = now()
   where id = p_ticket_id;
end $$;
grant execute on function public.set_ticket_status(uuid, text) to authenticated;

-- How many need attention — for the admin sidebar badge.
create or replace function public.admin_open_ticket_count()
returns int
language sql security definer set search_path = public stable as $$
  select case when public.is_admin()
    then (select count(*)::int from public.tickets where status = 'open')
    else 0 end;
$$;
grant execute on function public.admin_open_ticket_count() to authenticated;

-- ── Signed-out lookup (service role only, called from /api/ticket) ───────────
-- Requires BOTH the case id and the token, so a guessed case number reveals
-- nothing. Never granted to anon or authenticated.
create or replace function public.ticket_by_token(p_case_id text, p_token text)
returns table (
  case_id text, subject text, status text, created_at timestamptz,
  last_activity_at timestamptz, messages jsonb
)
language sql security definer set search_path = public stable as $$
  select t.case_id, t.subject, t.status, t.created_at, t.last_activity_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'author_role', m.author_role,
                    'author_name', m.author_name,
                    'body', m.body,
                    'created_at', m.created_at
                  ) order by m.created_at)
             from public.ticket_messages m where m.ticket_id = t.id
         ), '[]'::jsonb)
  from public.tickets t
  where t.case_id = upper(trim(p_case_id))
    and t.lookup_token = trim(p_token);
$$;
revoke all on function public.ticket_by_token(text, text) from public, anon, authenticated;

-- Signed-out reply, same token gate.
create or replace function public.reply_ticket_by_token(p_case_id text, p_token text, p_body text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if char_length(coalesce(trim(p_body), '')) < 1 then raise exception 'Message is empty.'; end if;
  select id, coalesce(name, 'Requester') into v_id, v_name
    from public.tickets
   where case_id = upper(trim(p_case_id)) and lookup_token = trim(p_token);
  if v_id is null then return false; end if;

  insert into public.ticket_messages (ticket_id, author_role, author_name, body)
  values (v_id, 'user', v_name, trim(p_body));

  update public.tickets set status = 'open', last_activity_at = now() where id = v_id;
  return true;
end $$;
revoke all on function public.reply_ticket_by_token(text, text, text) from public, anon, authenticated;
