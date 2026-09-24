-- ============================================================================
-- Syllabus-parse rate limiting — enforced in the DATABASE so it can't be
-- bypassed by calling the function directly.
--
--   • FREE: 5 successful parses a month; 180s after a success, 20s after a
--     failed one.
--   • PRO: no monthly cap (we sell "unlimited scans", so there is not one),
--     a 5s cooldown that only stops double-clicks, and a 40/day abuse stop.
--   • The plan is read from user_profile, the same two conditions the client
--     uses, so the limiter and the "Unlimited" meter cannot disagree.
--   • cancel_parse() releases the slot entirely when the failure was OURS
--     (parser unreachable, model 5xx, malformed response) — you should not be
--     locked out for three minutes because our dependency fell over.
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


-- ── Who is paying ────────────────────────────────────────────────────────────
-- The SAME two conditions the client reads (`plan_status = 'pro'`, or a live
-- `pro_until`), so the limiter and the screen showing "Unlimited" cannot
-- disagree about who is entitled to what. They did: the limiter never looked
-- at the plan at all, so a student who had just paid for "unlimited scans"
-- was stopped at five and told to wait three minutes.
create or replace function public.ct_parse_is_pro(p_user uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.user_profile p
     where p.user_id = p_user
       and (p.plan_status = 'pro' or (p.pro_until is not null and p.pro_until > now()))
  );
$$;

-- Claim a parse slot: enforce cooldown + monthly cap, then record the attempt.
-- Returns { allowed, reason?, retry_after?, used, limit, resets_at?, event_id? }.
create or replace function public.start_parse()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pro boolean;
  cooldown int;              -- seconds between uploads, set from the last attempt
  monthly_limit int;         -- successful parses / calendar month; null = no cap
  daily_ceiling int := 40;   -- Pro only: an abuse stop, not a product limit
  month_start timestamptz := date_trunc('month', now());
  last_at timestamptz;
  last_ok boolean;
  used int;
  today_used int;
  new_id uuid;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;

  -- Serialize concurrent requests from the same user (kills the check→insert race).
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  -- The cooldown exists to stop someone hammering the shared model quota, and
  -- it still does: what it must NOT do is punish a student whose upload failed.
  -- A failed attempt costs 20s, enough to keep a script slow, short enough that
  -- a person who just got an error can fix the file and try again.
  select created_at, success into last_at, last_ok
    from public.parse_events where user_id = uid
    order by created_at desc limit 1;
  /**
   * Pro pays for this; free is rationed.
   *
   * Free keeps the old numbers: 180s after a success is a real brake on the
   * shared model quota, and 20s after a failure so a person who just got an
   * error can fix the file and retry.
   *
   * Pro gets 5s, which is not a rationing device -- it stops a double-click
   * and a runaway loop and nothing else. The ceiling that protects the quota
   * for a paying account is the DAILY one below, because a per-upload wait
   * punishes the one genuine burst that happens (adding six classes on the
   * first day of term) while doing nothing about a script.
   */
  pro := public.ct_parse_is_pro(uid);
  cooldown := case
                when pro then 5
                when coalesce(last_ok, false) then 180
                else 20
              end;
  monthly_limit := case when pro then null else 5 end;

  if last_at is not null and last_at > now() - make_interval(secs => cooldown) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'retry_after', greatest(1, ceil(extract(epoch from (last_at + make_interval(secs => cooldown) - now()))))
    );
  end if;

  select count(*) into used from public.parse_events
    where user_id = uid and success and created_at >= month_start;

  if monthly_limit is not null and used >= monthly_limit then
    return jsonb_build_object(
      'allowed', false, 'reason', 'monthly',
      'used', used, 'limit', monthly_limit, 'resets_at', month_start + interval '1 month'
    );
  end if;

  -- Pro's only ceiling, and it is set where no real student will ever meet it:
  -- forty successful parses in a day is not a term's worth of syllabi, it is a
  -- script. The refusal says so rather than claiming they used up an allowance
  -- they were told they did not have.
  if pro then
    select count(*) into today_used from public.parse_events
      where user_id = uid and success and created_at >= now() - interval '24 hours';
    if today_used >= daily_ceiling then
      return jsonb_build_object(
        'allowed', false, 'reason', 'daily',
        'used', today_used, 'limit', daily_ceiling
      );
    end if;
  end if;

  insert into public.parse_events (user_id) values (uid) returning id into new_id;
  return jsonb_build_object(
    'allowed', true, 'event_id', new_id, 'used', used,
    'limit', monthly_limit, 'pro', pro
  );
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

-- Release a claimed attempt outright. Called when the failure was on our side
-- of the line — the model was unreachable, returned 5xx, or answered with
-- something we could not read. Deleting the row means no cooldown at all,
-- because the student did nothing wrong and got nothing back.
--
-- Scoped to the caller and to UNSUCCESSFUL rows, so it can never be used to
-- erase a success and dodge the monthly cap.
create or replace function public.cancel_parse(p_event uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- MARK, do not delete: a deleted row takes the failure's reason with it
  -- (and stops the hourly ceiling seeing it). Kept in step with
  -- db/stats_and_terms.sql + db/parse_hardening.sql, because re-running THIS
  -- file after those quietly restored the delete.
  update public.parse_events
     set refunded = true
   where id = p_event and user_id = auth.uid() and success = false;
end;
$$;

-- Read-only usage for the UI (the user's own).
--
-- It used to return a hard-coded 5 and 180 for everyone, so the meter in
-- Settings was wrong twice over: wrong for a Pro account, which has neither,
-- and wrong about the cooldown even for a free one, since a FAILED attempt
-- costs 20s and this claimed 180. Both now come from the same branch
-- start_parse takes.
create or replace function public.get_parse_usage()
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'used', (select count(*) from public.parse_events
             where user_id = auth.uid() and success and created_at >= date_trunc('month', now())),
    -- null means no cap, which is what "unlimited" has to resolve to.
    'limit', case when public.ct_parse_is_pro(auth.uid()) then null else 5 end,
    'pro', public.ct_parse_is_pro(auth.uid()),
    'cooldown', case when public.ct_parse_is_pro(auth.uid()) then 5 else 180 end,
    'resets_at', date_trunc('month', now()) + interval '1 month',
    'last_at', (select max(created_at) from public.parse_events where user_id = auth.uid())
  );
$$;

grant execute on function public.ct_parse_is_pro(uuid) to authenticated;
grant execute on function public.start_parse() to authenticated;
grant execute on function public.finish_parse(uuid) to authenticated;
grant execute on function public.cancel_parse(uuid) to authenticated;
grant execute on function public.get_parse_usage() to authenticated;
