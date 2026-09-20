-- ============================================================================
-- The business overview page: daily series, headline counts, activity feed.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- Money is NOT in here. Revenue, MRR and who is paying come from Stripe, read
-- server-side -- our billing columns are a cache the webhook writes, and a
-- dashboard built on the cache cannot notice when the cache is wrong. What
-- Postgres owns is what Postgres is the source of truth for: signups,
-- visitors, and what people did.
--
-- INTERNAL ACCOUNTS ARE EXCLUDED EVERYWHERE. Twelve of forty accounts are the
-- founder's own, and a growth chart that counts them is a chart of one person
-- testing the product.
-- ============================================================================

-- ── One row per day, gaps included ──────────────────────────────────────────
-- generate_series, not group-by-date: a day with no signups has to appear as
-- a zero, or the chart draws a straight line between the days either side and
-- quietly reports activity that never happened.
create or replace function public.admin_daily_series(p_days int default 30)
returns table (
  day        date,
  signups    int,
  visitors   int,
  active     int,
  page_views int
)
language sql security definer set search_path = public stable as $$
  with days as (
    select generate_series(
      (current_date - (greatest(1, least(coalesce(p_days, 30), 365)) - 1) * interval '1 day')::date,
      current_date,
      interval '1 day'
    )::date as d
  ),
  real_users as (
    select user_id from public.user_profile where coalesce(is_internal, false) = false
  )
  select
    days.d,
    (select count(*)::int from public.user_profile p
      where coalesce(p.is_internal, false) = false and p.created_at::date = days.d),
    -- A VISITOR is a distinct visitor_id, signed in or not: it is the top of
    -- the funnel and the only number here that includes people with no account.
    (select count(distinct e.visitor_id)::int from public.site_events e
      where e.created_at::date = days.d
        and (e.user_id is null or e.user_id in (select user_id from real_users))),
    -- ACTIVE is a distinct signed-in account. Always <= visitors.
    (select count(distinct e.user_id)::int from public.site_events e
      where e.created_at::date = days.d
        and e.user_id in (select user_id from real_users)),
    (select count(*)::int from public.site_events e
      where e.created_at::date = days.d and e.kind = 'view'
        and (e.user_id is null or e.user_id in (select user_id from real_users)))
  from days
  where public.is_admin()
  order by days.d;
$$;
grant execute on function public.admin_daily_series(int) to authenticated;

-- ── Headline counts ─────────────────────────────────────────────────────────
create or replace function public.admin_overview_counts()
returns jsonb
language sql security definer set search_path = public stable as $$
  select case when not public.is_admin() then '{}'::jsonb else jsonb_build_object(
    'users_total',    (select count(*)::int from public.user_profile where coalesce(is_internal,false) = false),
    'signups_24h',    (select count(*)::int from public.user_profile
                        where coalesce(is_internal,false) = false and created_at > now() - interval '24 hours'),
    'signups_7d',     (select count(*)::int from public.user_profile
                        where coalesce(is_internal,false) = false and created_at > now() - interval '7 days'),
    'visitors_24h',   (select count(distinct visitor_id)::int from public.site_events
                        where created_at > now() - interval '24 hours'),
    'active_7d',      (select count(distinct e.user_id)::int from public.site_events e
                        join public.user_profile p on p.user_id = e.user_id
                        where e.created_at > now() - interval '7 days' and coalesce(p.is_internal,false) = false),
    'comped',         (select count(*)::int from public.user_profile where coalesce(comped,false)),
    'internal',       (select count(*)::int from public.user_profile where coalesce(is_internal,false)),
    'courses',        (select count(*)::int from public.courses c
                        join public.user_profile p on p.user_id = c.user_id
                        where coalesce(p.is_internal,false) = false and coalesce(c.archived,false) = false),
    'open_tickets',   (select count(*)::int from public.tickets where status = 'open'),
    -- How far back the visitor data actually goes. A "since launch" chart
    -- drawn over three weeks of tracking is a chart with a lie in its axis.
    'events_since',   (select min(created_at) from public.site_events)
  ) end;
$$;
grant execute on function public.admin_overview_counts() to authenticated;

-- ── Recent activity ─────────────────────────────────────────────────────────
-- Real rows from real tables, unioned and sorted. The old dashboards showed a
-- feed assembled from whatever was handy; this one can only show things that
-- actually happened, because each branch is a select from the thing itself.
create or replace function public.admin_recent_activity(p_limit int default 20)
returns table (
  kind       text,
  label      text,
  detail     text,
  who        text,
  at         timestamptz
)
language sql security definer set search_path = public stable as $$
  select * from (
    -- The FIRST branch names the columns for the whole union; without these
    -- aliases the literals come out as `?column?` and `order by at` has
    -- nothing to resolve against (42703).
    select 'signup'::text                                   as kind,
           'New account'::text                              as label,
           coalesce(p.program, 'No program yet')::text      as detail,
           coalesce(p.name, p.email, 'Unnamed')::text       as who,
           p.created_at                                     as happened_at
      from public.user_profile p
     where coalesce(p.is_internal, false) = false

    union all
    select 'ticket', 'Support ticket', t.subject,
           coalesce(t.name, t.email, 'Anonymous'), t.created_at
      from public.tickets t

    -- NOT courses: `public.courses` has no timestamp column at all, so there
    -- is no honest way to place one on a timeline. A parse is the closest
    -- real signal of the same thing -- somebody setting a class up -- and it
    -- is stamped.
    union all
    select 'parse', 'Syllabus parsed',
           case when pe.success then 'Imported' else coalesce(pe.error, 'Failed') end,
           coalesce(p.name, p.email, 'Unnamed'), pe.created_at
      from public.parse_events pe
      join public.user_profile p on p.user_id = pe.user_id
     where coalesce(p.is_internal, false) = false

    union all
    select 'bug', 'Bug report', left(coalesce(b.title, b.description, ''), 80),
           coalesce(b.user_email, 'Anonymous'), b.created_at
      from public.bug_reports b

    union all
    select 'admin', 'Admin action: ' || l.action, l.reason,
           coalesce(l.actor_email, 'unknown'), l.created_at
      from public.admin_audit_log l
  ) rows
  where public.is_admin()
  order by rows.happened_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;
grant execute on function public.admin_recent_activity(int) to authenticated;

-- The series scans site_events by date; without this it is a full scan per day.
create index if not exists site_events_created_idx on public.site_events (created_at);
create index if not exists user_profile_created_idx on public.user_profile (created_at);

-- Check:
--   select * from public.admin_daily_series(14);
--   select jsonb_pretty(public.admin_overview_counts());
--   select * from public.admin_recent_activity(10);
