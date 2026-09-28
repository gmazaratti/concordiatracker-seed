-- ── Live Activity push-to-start ──────────────────────────────────────────────
--
-- The "next assignment due" Live Activity (Lock Screen + Dynamic Island) is
-- started by the app whenever it is open inside the window. To start it with
-- the app CLOSED, iOS 17.2+ gives each phone a push-to-start token (distinct
-- from its ordinary APNs device token); the cron sends a start push to it when
-- a student's next assignment enters their window.
--
-- One start per assignment-and-due-time, recorded in live_activity_starts, so
-- a second cron tick does not start it again. A moved deadline is a new start.
--
-- Safe to re-run.

create table if not exists public.live_activity_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  apns_env   text check (apns_env in ('production', 'sandbox')),
  updated_at timestamptz not null default now()
);
alter table public.live_activity_tokens enable row level security;
-- No policies: written through the functions below, read by the service role.
create index if not exists live_activity_tokens_user_idx on public.live_activity_tokens (user_id);

-- A phone that changes hands moves its token to whoever signed in.
create or replace function public.register_live_activity_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  if p_token !~ '^[0-9a-f]{32,200}$' then raise exception 'Not a push-to-start token.'; end if;
  insert into public.live_activity_tokens (token, user_id, updated_at)
  values (p_token, auth.uid(), now())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

create or replace function public.unregister_live_activity_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.live_activity_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_live_activity_token(text) from public, anon;
revoke all on function public.unregister_live_activity_token(text) from public, anon;
grant execute on function public.register_live_activity_token(text) to authenticated;
grant execute on function public.unregister_live_activity_token(text) to authenticated;

create table if not exists public.live_activity_starts (
  user_id       uuid not null references auth.users (id) on delete cascade,
  assessment_id uuid not null,
  due_at        timestamptz not null,
  started_at    timestamptz not null default now(),
  primary key (user_id, assessment_id, due_at)
);
alter table public.live_activity_starts enable row level security;

-- Each person's NEXT open assignment, if it has just entered their window and
-- has not been started for yet. Returns every push-to-start token they have.
create or replace function public.claim_live_activity_starts()
returns table (
  user_id uuid,
  tokens jsonb,
  assessment_id uuid,
  title text,
  course text,
  course_id text,
  color text,
  due_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with prefs as (
    select p.user_id as uid,
           coalesce((p.ui_state -> 'assignmentReminders' ->> 'liveActivity')::boolean, true) as on_,
           least(24, greatest(1, coalesce((p.ui_state -> 'assignmentReminders' ->> 'liveWindowHours')::numeric, 6))) as hours
      from public.user_profile p
     where exists (select 1 from public.live_activity_tokens t where t.user_id = p.user_id)
  ),
  nxt as (
    select distinct on (a.user_id)
           a.user_id as uid, a.id as aid, a.title as atitle, coalesce(c.code, '') as acourse,
           a.course_id as acourse_id, coalesce(c.color, '') as acolor, a.date as adue
      from public.assignments a
      join prefs pr on pr.uid = a.user_id and pr.on_
      left join public.courses c on c.id = a.course_id
     where coalesce(a.deleted, false) = false
       and coalesce(a.done, false) = false
       and coalesce(a.status, 'not-started') in ('not-started', 'in-progress', 'extension')
       and a.date > now() + interval '5 minutes'
     order by a.user_id, a.date
  ),
  due_now as (
    select n.* from nxt n join prefs pr on pr.uid = n.uid
     where n.adue <= now() + make_interval(secs => (pr.hours * 3600)::double precision)
  ),
  claimed as (
    insert into public.live_activity_starts (user_id, assessment_id, due_at)
    select d.uid, d.aid, d.adue from due_now d
    on conflict do nothing
    returning live_activity_starts.user_id, live_activity_starts.assessment_id
  )
  select d.uid,
         (select jsonb_agg(jsonb_build_object('token', t.token, 'env', t.apns_env))
            from public.live_activity_tokens t where t.user_id = d.uid),
         d.aid, d.atitle, d.acourse, d.acourse_id, d.acolor, d.adue
    from due_now d
    join claimed cl on cl.user_id = d.uid and cl.assessment_id = d.aid;
end;
$$;

revoke all on function public.claim_live_activity_starts() from public, anon, authenticated;
grant execute on function public.claim_live_activity_starts() to service_role;

-- A token APNs has said is dead, or the env that worked.
create or replace function public.live_activity_token_result(p_token text, p_gone boolean, p_env text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_gone then
    delete from public.live_activity_tokens where token = p_token;
  elsif p_env in ('production', 'sandbox') then
    update public.live_activity_tokens set apns_env = p_env where token = p_token;
  end if;
end;
$$;
revoke all on function public.live_activity_token_result(text, boolean, text) from public, anon, authenticated;
grant execute on function public.live_activity_token_result(text, boolean, text) to service_role;
