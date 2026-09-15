-- ============================================================================
-- Three things the admin numbers could not tell you.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
--   1. WHICH Pro users are actually paying (1 of 7, it turns out)
--   2. WHY a syllabus parse failed
--   3. Term spellings, normalised — "FALL 2026" was its own term
-- ============================================================================

-- ── 1. Terms: one spelling ──────────────────────────────────────────────────
-- Found in production: "Summer 2026" AND "SUMMER 2026", "Fall 2026" AND
-- "FALL 2026", and one "Automne 2026" from a French outline. Term is compared
-- by STRING EQUALITY in the Courses tabs, `sortTermsDesc`, the GPA buckets and
-- `termRank`, so each variant quietly became a separate term: its own tab, its
-- own GPA row, sorted wrong.
--
-- Mirrors src/lib/term.ts `normalizeTerm`. Anything it cannot parse is left
-- exactly as typed — a term we do not understand is still the student's own
-- text and better shown as written than replaced with a guess.
create or replace function public.ct_normalize_term(p_term text)
returns text
language sql immutable as $$
  with t as (
    select btrim(regexp_replace(p_term, '\s+', ' ', 'g')) as raw
  ), m as (
    -- The season and the year come out of ONE regex. An earlier version took
    -- the season with split_part(raw, ' ', 1), which cannot see "Fall/2026" —
    -- there is no space in it, so the whole string came back as the season and
    -- nothing matched. The separator is part of the pattern here instead.
    select raw,
           lower(substring(raw from '^([A-Za-zÀ-ÿ]+)[ /-]+[0-9]{4}$')) as season,
           substring(raw from '^[A-Za-zÀ-ÿ]+[ /-]+([0-9]{4})$')        as yr
      from t
  )
  select case
    when p_term is null then p_term
    when raw = '' then raw
    -- coalesce back to `raw`: an unrecognised season ("Intersession 2026")
    -- makes the CASE null, and a term we do not understand is still the
    -- student's own text. Better shown as written than replaced with a guess.
    else coalesce(
      (case season
         when 'fall'      then 'Fall'   when 'automne'   then 'Fall'
         when 'autumn'    then 'Fall'
         when 'winter'    then 'Winter' when 'hiver'     then 'Winter'
         when 'summer'    then 'Summer' when 'ete'       then 'Summer'
         when 'été'      then 'Summer'
         when 'spring'    then 'Spring' when 'printemps' then 'Spring'
       end) || ' ' || yr,
      raw)
  end from m;
$$;

-- Preview before it changes anything:
--   select term, ct_normalize_term(term) as becomes, count(*)
--     from public.courses where term is distinct from ct_normalize_term(term)
--    group by 1, 2;

-- The backfill DISCOVERS its targets instead of naming them. The first version
-- of this file hard-coded `public.past_courses`, which does not exist — past
-- courses are just `courses` with `archived = true` — and one missing table
-- aborts the whole migration on its very first statement. Asking the catalogue
-- which base tables actually have a text `term` column cannot be wrong about
-- that, and it picks up any table added later for free.
do $$
declare
  t record;
  n bigint;
begin
  for t in
    select c.table_schema, c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema
       and tb.table_name  = c.table_name
     where c.table_schema = 'public'
       and c.column_name  = 'term'
       and c.data_type in ('text', 'character varying')
       and tb.table_type  = 'BASE TABLE'      -- never a view
     order by c.table_name
  loop
    execute format(
      'update %I.%I set term = public.ct_normalize_term(term)
        where term is distinct from public.ct_normalize_term(term)',
      t.table_schema, t.table_name);
    get diagnostics n = row_count;
    raise notice 'ct_normalize_term: %.% -> % row(s) rewritten', t.table_schema, t.table_name, n;
  end loop;
end $$;

-- ── 2. Why a parse failed ───────────────────────────────────────────────────
-- `parse_events` recorded success as a boolean and nothing else, so a 32%
-- failure rate was visible and completely undiagnosable. Now the reason is
-- stored, and a failure that was OUR fault is marked `refunded` so it costs no
-- cooldown while STILL leaving the evidence behind — the old `cancel_parse`
-- deleted the row, which threw away exactly the record we now want.
alter table public.parse_events
  add column if not exists error    text,
  add column if not exists refunded boolean not null default false;

create or replace function public.fail_parse(p_event uuid, p_error text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.parse_events
     set error = left(coalesce(p_error, ''), 400)
   where id = p_event and user_id = auth.uid() and success = false;
end;
$$;

-- Keeps the row (so the reason survives) but excuses the cooldown.
create or replace function public.cancel_parse(p_event uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.parse_events
     set refunded = true
   where id = p_event and user_id = auth.uid() and success = false;
end;
$$;

-- A refunded attempt no longer counts against the cooldown.
create or replace function public.start_parse()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cooldown int;
  monthly_limit int := 5;
  month_start timestamptz := date_trunc('month', now());
  last_at timestamptz;
  last_ok boolean;
  used int;
  new_id uuid;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select created_at, success into last_at, last_ok
    from public.parse_events
   where user_id = uid and not refunded
   order by created_at desc limit 1;
  cooldown := case when coalesce(last_ok, false) then 180 else 20 end;

  if last_at is not null and last_at > now() - make_interval(secs => cooldown) then
    return jsonb_build_object('allowed', false, 'reason', 'cooldown',
      'retry_after', greatest(1, ceil(extract(epoch from (last_at + make_interval(secs => cooldown) - now())))));
  end if;

  select count(*) into used from public.parse_events
   where user_id = uid and success and created_at >= month_start;
  if used >= monthly_limit then
    return jsonb_build_object('allowed', false, 'reason', 'monthly',
      'used', used, 'limit', monthly_limit, 'resets_at', month_start + interval '1 month');
  end if;

  insert into public.parse_events (user_id) values (uid) returning id into new_id;
  return jsonb_build_object('allowed', true, 'event_id', new_id, 'used', used, 'limit', monthly_limit);
end;
$$;

grant execute on function public.fail_parse(uuid, text) to authenticated;
grant execute on function public.cancel_parse(uuid) to authenticated;

-- The cooldown the UI shows was ALWAYS 180s, because `get_parse_usage` returned
-- one hard-coded number while the database charged 20s for a failure. So a
-- student whose upload failed was told they were locked out for three minutes
-- when they were free to retry after twenty seconds. It now returns the
-- cooldown that actually applies to THEIR last attempt.
create or replace function public.get_parse_usage()
returns jsonb
language sql security definer set search_path = public stable as $$
  with last as (
    select created_at, success, refunded
      from public.parse_events
     where user_id = auth.uid()
     order by created_at desc limit 1
  )
  select jsonb_build_object(
    'used', (select count(*) from public.parse_events
             where user_id = auth.uid() and success and created_at >= date_trunc('month', now())),
    'limit', 5,
    -- 0 when the attempt was refunded (our fault — no wait at all),
    -- 180 after a success, 20 after a failure the student can act on.
    'cooldown', coalesce((select case when refunded then 0
                                      when success then 180
                                      else 20 end from last), 180),
    'resets_at', date_trunc('month', now()) + interval '1 month',
    'last_at', (select created_at from last)
  );
$$;
grant execute on function public.get_parse_usage() to authenticated;

-- What failed, and why. Admin only.
create or replace function public.admin_parse_failures()
returns table (created_at timestamptz, handle text, refunded boolean, error text)
language sql security definer set search_path = public stable as $$
  select e.created_at, p.handle, e.refunded, e.error
    from public.parse_events e
    left join public.user_profile p on p.user_id = e.user_id
   where public.is_admin() and not e.success
   order by e.created_at desc
   limit 100;
$$;
grant execute on function public.admin_parse_failures() to authenticated;

-- ── 3. Paying vs granted ────────────────────────────────────────────────────
-- `admin_dashboard_stats` counted `pro_users` and stopped there, which reads as
-- revenue and is not: of 7 Pro accounts, ONE has an active Stripe subscription.
-- Four were granted by an admin and two are Pro with no payment and no grant
-- record at all. Those are three different facts and the dashboard showed one
-- number.
create or replace function public.admin_pro_breakdown()
returns jsonb
language sql security definer set search_path = public stable as $$
  select case when not public.is_admin() then '{}'::jsonb else jsonb_build_object(
    'paying',    (select count(*) from public.user_profile
                   where stripe_subscription_id is not null and subscription_status = 'active'),
    'trialing',  (select count(*) from public.user_profile
                   where stripe_subscription_id is not null and subscription_status = 'trialing'),
    'lapsed',    (select count(*) from public.user_profile
                   where stripe_subscription_id is not null
                     and subscription_status not in ('active', 'trialing')),
    'granted',   (select count(*) from public.user_profile
                   where plan_status = 'pro' and stripe_subscription_id is null
                     and (pro_gift_by is not null or pro_until is not null)),
    -- Pro with no payment and no record of being given it. Worth seeing,
    -- because it means something set the flag that nothing is accounting for.
    'unexplained', (select count(*) from public.user_profile
                   where plan_status = 'pro' and stripe_subscription_id is null
                     and pro_gift_by is null and pro_until is null),
    'pro_total', (select count(*) from public.user_profile where plan_status = 'pro')
  ) end;
$$;
grant execute on function public.admin_pro_breakdown() to authenticated;

-- Check:
--   select term, count(*) from public.courses group by 1 order by 1;
--   select * from public.admin_pro_breakdown();
--   select * from public.admin_parse_failures();
