-- ============================================================================
-- Syllabus-parse rate limiting — enforced in the DATABASE so it can't be
-- bypassed by calling the function directly.
--
--   • Cooldown: 180s between uploads (any attempt, success or not).
--   • Monthly cap: 5 SUCCESSFUL parses per calendar month.
--
-- `parse_events` has RLS on with NO policies → users cannot read, insert,
-- update, or delete it directly. The only way in is the SECURITY DEFINER
-- functions below, which the Edge function calls with the user's JWT. So a user
-- can't reset their counter, forge successes for someone else, or spam Gemini —
-- the only path to the model is the function, and it always passes through
-- start_parse() first.
-- ============================================================================

create table if not exists public.parse_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  success boolean not null default false
);
alter table public.parse_events enable row level security; -- no policies = deny-all to clients
create index if not exists parse_events_user_time_idx on public.parse_events (user_id, created_at desc);

-- Claim a parse slot: enforce cooldown + monthly cap, then record the attempt.
-- Returns { allowed, reason?, retry_after?, used, limit, resets_at?, event_id? }.
create or replace function public.start_parse()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cooldown int := 180;       -- seconds between uploads
  monthly_limit int := 5;    -- successful parses / calendar month
  month_start timestamptz := date_trunc('month', now());
  last_at timestamptz;
  used int;
  new_id uuid;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;

  -- Serialize concurrent requests from the same user (kills the check→insert race).
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select max(created_at) into last_at from public.parse_events where user_id = uid;
  if last_at is not null and last_at > now() - make_interval(secs => cooldown) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'retry_after', greatest(1, ceil(extract(epoch from (last_at + make_interval(secs => cooldown) - now()))))
    );
  end if;

  select count(*) into used from public.parse_events
    where user_id = uid and success and created_at >= month_start;
  if used >= monthly_limit then
    return jsonb_build_object(
      'allowed', false, 'reason', 'monthly',
      'used', used, 'limit', monthly_limit, 'resets_at', month_start + interval '1 month'
    );
  end if;

  insert into public.parse_events (user_id) values (uid) returning id into new_id;
  return jsonb_build_object('allowed', true, 'event_id', new_id, 'used', used, 'limit', monthly_limit);
end;
$$;

-- Mark a claimed attempt successful (counts toward the monthly cap). Scoped to
-- the caller, so you can only ever mark your own attempt.
create or replace function public.finish_parse(p_event uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.parse_events set success = true where id = p_event and user_id = auth.uid();
end;
$$;

-- Read-only usage for the UI (the user's own).
create or replace function public.get_parse_usage()
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'used', (select count(*) from public.parse_events
             where user_id = auth.uid() and success and created_at >= date_trunc('month', now())),
    'limit', 5,
    'cooldown', 180,
    'resets_at', date_trunc('month', now()) + interval '1 month',
    'last_at', (select max(created_at) from public.parse_events where user_id = auth.uid())
  );
$$;

grant execute on function public.start_parse() to authenticated;
grant execute on function public.finish_parse(uuid) to authenticated;
grant execute on function public.get_parse_usage() to authenticated;
