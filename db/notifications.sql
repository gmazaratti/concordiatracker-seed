-- ============================================================================
-- Notifications — stored, because some news cannot be derived.
-- Run in the SQL editor. Idempotent.
--
-- The activity panel until now DERIVED everything it showed: followed orgs'
-- upcoming events, pending friend requests. That works for standing state and
-- cannot work for these two, for a reason worth writing down:
--
--   A status change is a POINT IN TIME. Derived from the current row, "moved
--   to Planned" would still be claiming Planned after it shipped — and anyone
--   who reacted to the request AFTER the change would be told about something
--   that happened before they were involved. The sentence has to be written
--   when it happens, to the people involved at that moment.
-- ============================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,                      -- request_status | request_comment
  -- The rendered sentence, not a template. See the note above: recomposing it
  -- later from live rows would rewrite history every time the subject moves.
  title       text not null,
  body        text,
  link        text,                               -- in-app path
  subject_id  uuid,                               -- the feature request
  actor_name  text,                               -- display only, never an id
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

-- SELECT only. There is no insert, update or delete policy anywhere in this
-- file: every write goes through a SECURITY DEFINER function, so nobody can
-- mint a notification, forge who it came from, or edit the sentence they were
-- sent. Same shape as tickets and blocks.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

-- ── Marking read ─────────────────────────────────────────────────────────────
-- An RPC rather than an update policy: a policy scoped to own rows would also
-- let someone rewrite `title` on a notification they received, and the whole
-- point of storing the sentence is that it is a record.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ── Fan-out ──────────────────────────────────────────────────────────────────
-- Everyone with a stake in a request: whoever posted it, whoever reacted, and
-- whoever commented. A reaction is a small thing to have done, but it is the
-- only way most people say "I want this", and telling them when it happens is
-- the entire reason they pressed it.
create or replace function public.ct_request_audience(p_request uuid, p_exclude uuid)
returns setof uuid
language sql stable as $$
  select distinct u from (
    select user_id as u from public.feature_requests            where id = p_request
    union select user_id from public.feature_request_reactions  where request_id = p_request
    union select user_id from public.feature_request_comments   where request_id = p_request
  ) a
  where u is not null and (p_exclude is null or u <> p_exclude)
$$;

create or replace function public.ct_notify(
  p_users uuid[], p_kind text, p_title text, p_body text, p_link text,
  p_subject uuid, p_actor text
) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.notifications (user_id, kind, title, body, link, subject_id, actor_name)
  select u, p_kind, p_title, p_body, p_link, p_subject, p_actor
    from unnest(p_users) as u;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Status changes ───────────────────────────────────────────────────────────
-- A TRIGGER, not a wrapper around admin_moderate_request. The status can be
-- moved by that RPC, by the next one somebody writes, by a script, or by hand
-- in the SQL editor — and a notification that depends on remembering to call
-- it is one that eventually does not get sent.
create or replace function public.ct_on_request_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare audience uuid[];
begin
  if new.status is not distinct from old.status then return new; end if;

  select array_agg(u) into audience
    from public.ct_request_audience(new.id, auth.uid()) u;
  if audience is null then return new; end if;

  perform public.ct_notify(
    audience,
    'request_status',
    format('%s is now %s', new.title, new.status),
    'You asked for this, or backed someone who did.',
    '/feedback?request=' || new.id::text,
    new.id,
    null
  );
  return new;
end $$;

drop trigger if exists trg_request_status on public.feature_requests;
create trigger trg_request_status
  after update of status on public.feature_requests
  for each row execute function public.ct_on_request_status();

-- ── Replies ──────────────────────────────────────────────────────────────────
create or replace function public.ct_on_request_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare audience uuid[]; subject text;
begin
  if new.hidden then return new; end if;

  select array_agg(u) into audience
    from public.ct_request_audience(new.request_id, new.user_id) u;
  if audience is null then return new; end if;

  select title into subject from public.feature_requests where id = new.request_id;

  perform public.ct_notify(
    audience,
    'request_comment',
    format('%s replied on "%s"', coalesce(new.author_name, 'Someone'), coalesce(subject, 'a request')),
    -- Enough of the reply to know whether it needs you, not the whole thing.
    left(new.body, 140),
    '/feedback?request=' || new.request_id::text,
    new.request_id,
    new.author_name
  );
  return new;
end $$;

drop trigger if exists trg_request_comment on public.feature_request_comments;
create trigger trg_request_comment
  after insert on public.feature_request_comments
  for each row execute function public.ct_on_request_comment();

-- ── Follows ──────────────────────────────────────────────────────────────────
-- Somebody following you is the other point-in-time event on this list: the
-- row it creates is standing state ("they follow you"), but "they STARTED
-- following you, since you last looked" is not recoverable from it once a
-- second person does the same. A trigger, for the same reason as the others.
create or replace function public.ct_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; slug text;
begin
  select coalesce(nullif(p.name, ''), 'Someone'), p.handle
    into who, slug
    from public.user_profile p
   where p.user_id = new.follower;

  perform public.ct_notify(
    array[new.following],
    'follow',
    coalesce(who, 'Someone') || ' started following you',
    null,
    case when slug is null then null else '/@' || slug end,
    null,
    who
  );
  return new;
end $$;

drop trigger if exists trg_user_follow on public.user_follows;
create trigger trg_user_follow
  after insert on public.user_follows
  for each row execute function public.ct_on_follow();
