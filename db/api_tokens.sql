-- ============================================================================
-- API tokens — the credential behind /api/v1/owner/* and /api/v1/me/*.
-- RUN IN: Supabase → SQL Editor → paste → Run. Idempotent; safe to re-run.
--
-- WHY A SEPARATE CREDENTIAL AT ALL. A Supabase access token expires in an
-- hour and is minted by a browser sign-in, so it cannot drive a dashboard, a
-- cron job, or an agent. These are long-lived, named, revocable, and scoped
-- to exactly one of two things.
--
-- WHAT IS STORED. Only `sha256(token)`, hex. The plaintext is returned ONCE by
-- create_api_token and never again — there is no endpoint, RPC or column that
-- can give it back, which is the point: a database dump is not a set of live
-- credentials. sha256() is CORE Postgres (11+), not pgcrypto, so this file
-- needs no extension.
--
-- A plain hash with no salt or stretching is correct HERE and would be wrong
-- for a password: the input is 244 bits of `gen_random_uuid()`, so there is no
-- dictionary to run and no rainbow table that could ever contain it. Salting
-- protects low-entropy secrets; it would only stop us looking a token up.
--
-- TWO SCOPES, deliberately only two:
--   'owner' — whole-business statistics. Admin-issued (is_admin() enforced in
--             the function, not in the client). Reads AGGREGATES only; see
--             the note on /owner/users in api/_v1-owner.ts.
--   'me'    — the issuing user's own courses, assessments and GPA. Can read
--             and can make the same narrow edits the app makes.
-- A token can never widen its own scope: scope is fixed at creation and there
-- is no update path.
-- ============================================================================

-- ── 1. The table ────────────────────────────────────────────────────────────
create table if not exists public.api_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  scope         text not null check (scope in ('owner', 'me')),
  name          text not null,
  -- Unique so the same token can never be registered twice, and so a lookup
  -- by hash is an index hit rather than a scan.
  token_hash    text not null unique,
  -- The first characters of the plaintext, kept on purpose: it is how a person
  -- tells two tokens apart in a list without us storing anything usable.
  prefix        text not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  use_count     bigint not null default 0,
  revoked_at    timestamptz,
  -- A fixed-window limiter, held on the row itself. Two columns beat a second
  -- table for something read on every single request.
  window_start  timestamptz,
  window_count  integer not null default 0
);

create index if not exists api_tokens_user_idx on public.api_tokens (user_id, created_at desc);

alter table public.api_tokens enable row level security;

-- Select-own ONLY, and no insert/update/delete policy anywhere in this file.
-- Every write goes through a SECURITY DEFINER function below, so `scope`,
-- `token_hash` and `user_id` cannot be chosen by a caller.
drop policy if exists "api_tokens_select_own" on public.api_tokens;
create policy "api_tokens_select_own" on public.api_tokens
  for select using (auth.uid() = user_id);

-- ── 2. Minting ──────────────────────────────────────────────────────────────
-- Two UUIDs = 244 bits, the same construction the calendar feed uses, for the
-- same reason: no extension required and far beyond guessing.
create or replace function public.ct_new_api_token(p_scope text)
returns text language sql volatile as $$
  select 'ct_' || case when p_scope = 'owner' then 'owner' else 'pat' end || '_'
         || replace(gen_random_uuid()::text, '-', '')
         || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.ct_hash_api_token(p_token text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
$$;

/**
 * Create a token and hand back the plaintext — the only time it exists.
 *
 * The caller names it; they do not choose the scope's power. An 'owner' token
 * is refused unless is_admin(), checked HERE rather than in the admin screen,
 * because a screen is a suggestion and a function is a rule.
 */
create or replace function public.create_api_token(p_name text, p_scope text default 'me')
returns table (id uuid, token text, prefix text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_count int;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if p_scope not in ('owner', 'me') then
    raise exception 'Unknown scope %', p_scope using errcode = '22023';
  end if;
  if p_scope = 'owner' and not public.is_admin() then
    raise exception 'Only an admin can create an owner token.' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Give the token a name so you can recognise it later.' using errcode = '22023';
  end if;

  -- A ceiling, so a loop in somebody's script cannot mint thousands of live
  -- credentials. Revoked ones do not count against it.
  select count(*) into v_count
    from public.api_tokens t
   where t.user_id = v_uid and t.revoked_at is null;
  if v_count >= 20 then
    raise exception 'You already have 20 active tokens. Revoke one first.' using errcode = '53400';
  end if;

  v_token := public.ct_new_api_token(p_scope);

  insert into public.api_tokens (user_id, scope, name, token_hash, prefix)
  values (v_uid, p_scope, left(v_name, 60), public.ct_hash_api_token(v_token), left(v_token, 15))
  returning api_tokens.id into id;

  token  := v_token;
  prefix := left(v_token, 15);
  return next;
end;
$$;

-- ── 3. Listing and revoking ────────────────────────────────────────────────
-- The hash is deliberately not selected: nothing needs it outside verification,
-- and a value that never leaves the server is one fewer thing to reason about.
create or replace function public.my_api_tokens()
returns table (
  id uuid, scope text, name text, prefix text,
  created_at timestamptz, last_used_at timestamptz, use_count bigint, revoked_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select t.id, t.scope, t.name, t.prefix,
         t.created_at, t.last_used_at, t.use_count, t.revoked_at
    from public.api_tokens t
   where t.user_id = auth.uid()
   order by t.revoked_at nulls first, t.created_at desc;
$$;

/**
 * Revoke. Kept as a timestamp rather than a delete so the list can still show
 * that a credential existed and stopped working, which is the first question
 * asked when something that used to run stops running.
 */
create or replace function public.revoke_api_token(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_hit int;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  update public.api_tokens t
     set revoked_at = now()
   where t.id = p_id and t.user_id = v_uid and t.revoked_at is null;
  get diagnostics v_hit = row_count;
  return v_hit > 0;
end;
$$;

-- ── 4. Verification (service role only) ────────────────────────────────────
/**
 * The hot path: hash in, identity out, usage counted, rate limit applied.
 *
 * ONE ROUND TRIP ON PURPOSE. Checking the token, bumping the counter and
 * deciding the limit are one statement because they are one decision; doing
 * them separately leaves a window where two concurrent requests both pass.
 *
 * `allowed = false` with a real row is a RATE LIMIT; no row at all is an
 * unknown or revoked token. The endpoint needs to tell those apart to answer
 * 429 versus 401.
 */
create or replace function public.ct_api_token_check(p_hash text, p_limit integer default 120)
returns table (user_id uuid, scope text, token_id uuid, allowed boolean, retry_after integer)
language plpgsql security definer set search_path = public as $$
declare v_now timestamptz := now();
begin
  return query
  with hit as (
    select t.id from public.api_tokens t
     where t.token_hash = p_hash and t.revoked_at is null
  ),
  bumped as (
    update public.api_tokens t
       set last_used_at = v_now,
           use_count    = t.use_count + 1,
           -- A fresh window resets the count; inside one, it climbs.
           window_start = case when t.window_start is null or t.window_start < v_now - interval '1 minute'
                               then v_now else t.window_start end,
           window_count = case when t.window_start is null or t.window_start < v_now - interval '1 minute'
                               then 1 else t.window_count + 1 end
      from hit
     where t.id = hit.id
     returning t.user_id, t.scope, t.id as token_id, t.window_count, t.window_start
  )
  select b.user_id, b.scope, b.token_id,
         b.window_count <= p_limit,
         greatest(1, 60 - extract(epoch from (v_now - b.window_start))::int)
    from bumped b;
end;
$$;

-- Verification runs as the service role from api/v1. Nothing in a browser
-- should be able to ask "does this hash belong to anyone", so it is taken away
-- from both public roles explicitly.
revoke all on function public.ct_api_token_check(text, integer) from anon, authenticated;
revoke all on function public.ct_hash_api_token(text) from anon, authenticated;
revoke all on function public.ct_new_api_token(text) from anon, authenticated;

grant execute on function public.create_api_token(text, text) to authenticated;
grant execute on function public.my_api_tokens() to authenticated;
grant execute on function public.revoke_api_token(uuid) to authenticated;

-- ============================================================================
-- 5. Owner statistics — ONE body, two guards.
--
-- The admin dashboard and /api/v1/owner must never be able to disagree about
-- how many users there are. They would, if each carried its own copy of the
-- counting SQL, because the copies drift the first time one is edited. So the
-- body moves into a `_raw` function with no guard, and the existing `admin_*`
-- functions become thin wrappers that only decide WHO may call.
--
-- Two callers, two gates: an admin in a browser (is_admin(), unchanged) and
-- the v1 endpoint holding an owner token (service role, execute revoked from
-- both public roles below). Neither can reach the other's door.
--
-- Re-running db/admin_overview.sql later restores its inline copy of the body.
-- That is harmless — it is the same SQL and returns the same numbers — but the
-- sharing is lost until this file runs again.
-- ============================================================================

create or replace function public.ct_overview_counts_raw()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'users_total',  (select count(*)::int from public.user_profile where coalesce(is_internal,false) = false),
    'signups_24h',  (select count(*)::int from public.user_profile
                      where coalesce(is_internal,false) = false and created_at > now() - interval '24 hours'),
    'signups_7d',   (select count(*)::int from public.user_profile
                      where coalesce(is_internal,false) = false and created_at > now() - interval '7 days'),
    'visitors_24h', (select count(distinct visitor_id)::int from public.site_events
                      where created_at > now() - interval '24 hours'),
    'active_7d',    (select count(distinct e.user_id)::int from public.site_events e
                      join public.user_profile p on p.user_id = e.user_id
                      where e.created_at > now() - interval '7 days' and coalesce(p.is_internal,false) = false),
    'comped',       (select count(*)::int from public.user_profile where coalesce(comped,false)),
    'internal',     (select count(*)::int from public.user_profile where coalesce(is_internal,false)),
    'courses',      (select count(*)::int from public.courses c
                      join public.user_profile p on p.user_id = c.user_id
                      where coalesce(p.is_internal,false) = false and coalesce(c.archived,false) = false),
    'open_tickets', (select count(*)::int from public.tickets where status = 'open'),
    'events_since', (select min(created_at) from public.site_events)
  );
$$;

create or replace function public.admin_overview_counts()
returns jsonb language sql security definer set search_path = public stable as $$
  select case when public.is_admin() then public.ct_overview_counts_raw() else '{}'::jsonb end;
$$;

-- The return type gains two columns, and `create or replace` cannot change a
-- return type — it errors rather than replacing. Both are dropped first.
drop function if exists public.admin_daily_series(int);
drop function if exists public.ct_daily_series_raw(int);
create or replace function public.ct_daily_series_raw(p_days int default 30)
returns table (day date, signups int, visitors int, active int, page_views int,
               subscribers int, trials int)
language sql security definer set search_path = public stable as $$
  with days as (
    select generate_series(
      (current_date - (greatest(1, least(coalesce(p_days, 30), 365)) - 1) * interval '1 day')::date,
      current_date, interval '1 day')::date as d
  ),
  real_users as (
    select user_id from public.user_profile where coalesce(is_internal, false) = false
  )
  select days.d,
    (select count(*)::int from public.user_profile p
      where coalesce(p.is_internal, false) = false and p.created_at::date = days.d),
    (select count(distinct e.visitor_id)::int from public.site_events e
      where e.created_at::date = days.d
        and (e.user_id is null or e.user_id in (select user_id from real_users))),
    (select count(distinct e.user_id)::int from public.site_events e
      where e.created_at::date = days.d and e.user_id in (select user_id from real_users)),
    (select count(*)::int from public.site_events e
      where e.created_at::date = days.d and e.kind = 'view'
        and (e.user_id is null or e.user_id in (select user_id from real_users))),
    -- SUBSCRIBERS: subscriptions that STARTED that day, read from Stripe's own
    -- event log rather than from user_profile, which holds only the CURRENT
    -- state and so cannot say what was true last Tuesday.
    (select count(*)::int from public.stripe_events se
      where se.processed_at::date = days.d
        and se.type = 'customer.subscription.created'),
    -- TRIALS: trials whose end date is that day, i.e. the day each one
    -- converts or lapses. NOT trials started — nothing in this schema records
    -- when a trial BEGAN (user_profile has trial_end and no start, and
    -- stripe_events stores no payload), and a start inferred from
    -- trial_end minus an assumed length would be wrong for every account
    -- created while STRIPE_TRIAL_DAYS was 7. If starts are wanted, the
    -- webhook has to write the date down first.
    (select count(*)::int from public.user_profile tp
      where coalesce(tp.is_internal, false) = false
        and tp.trial_end::date = days.d)
  from days order by days.d;
$$;

create or replace function public.admin_daily_series(p_days int default 30)
returns table (day date, signups int, visitors int, active int, page_views int,
               subscribers int, trials int)
language sql security definer set search_path = public stable as $$
  select s.day, s.signups, s.visitors, s.active, s.page_views, s.subscribers, s.trials
    from public.ct_daily_series_raw(p_days) s
   where public.is_admin();
$$;

/**
 * Cohorts, for /api/v1/owner/users.
 *
 * COUNTS, NEVER A ROSTER. The obvious reading of "/users" is a list of people,
 * and that is exactly what this must not be: a stats token sitting in a cron
 * job or an agent config is a far looser credential than a session, and the
 * blast radius of one leaking has to stay at "they learned how the business is
 * doing" rather than "they took the user table". Identities stay behind the
 * admin console, where a human signs in each time.
 *
 * Internal accounts are excluded everywhere here, and comped accounts are
 * counted as users but reported separately so they can never read as revenue.
 */
create or replace function public.ct_owner_users_raw()
returns jsonb language sql security definer set search_path = public stable as $$
  with real as (
    select * from public.user_profile where coalesce(is_internal, false) = false
  )
  select jsonb_build_object(
    'total',             (select count(*)::int from real),
    'comped',            (select count(*)::int from real where coalesce(comped,false)),
    'excluded_internal', (select count(*)::int from public.user_profile where coalesce(is_internal,false)),
    'new_7d',            (select count(*)::int from real where created_at > now() - interval '7 days'),
    'new_30d',           (select count(*)::int from real where created_at > now() - interval '30 days'),
    'active_7d',         (select count(distinct e.user_id)::int from public.site_events e
                           join real r on r.user_id = e.user_id
                           where e.created_at > now() - interval '7 days'),
    'active_30d',        (select count(distinct e.user_id)::int from public.site_events e
                           join real r on r.user_id = e.user_id
                           where e.created_at > now() - interval '30 days'),
    'with_courses',      (select count(distinct c.user_id)::int from public.courses c
                           join real r on r.user_id = c.user_id),
    'by_school',         coalesce((select jsonb_object_agg(k, n) from (
                           select coalesce(nullif(btrim(school), ''), 'Not set') as k, count(*)::int as n
                             from real group by 1 order by 2 desc limit 20) s), '{}'::jsonb),
    'by_program',        coalesce((select jsonb_object_agg(k, n) from (
                           select coalesce(nullif(btrim(program), ''), 'Not set') as k, count(*)::int as n
                             from real group by 1 order by 2 desc limit 20) s), '{}'::jsonb)
  );
$$;

-- Service role only. An owner token is verified by api/v1, which then reads
-- these as the service role; nothing in a browser has any business calling an
-- ungated statistic.
revoke all on function public.ct_overview_counts_raw() from anon, authenticated;
revoke all on function public.ct_daily_series_raw(int) from anon, authenticated;
revoke all on function public.ct_owner_users_raw() from anon, authenticated;

grant execute on function public.admin_overview_counts() to authenticated;
grant execute on function public.admin_daily_series(int) to authenticated;
