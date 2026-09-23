-- ============================================================================
-- Visit numbers that mean what they say.
--
-- MEASURED FIRST, on the session that prompted this (one tab, Sep 15 → 23):
--   44 page views, 2,561 heartbeat pings, first-to-last span of 8 days.
-- The panel showed "/app/calendar ×1758" and "192 hours". Two faults:
--   1. The per-page count included kind = 'ping' — the heartbeat the client
--      sends every 60s while the tab is visible — so a page left open racked
--      up a "view" a minute.
--   2. "Duration" was the span from a session's first event to its last. A
--      session is a browser TAB (sessionStorage), and a tab can stay open
--      for a week.
--
-- Now:
--   views           real page views only (kind = 'view')
--   active_seconds  distinct minutes with ANY event × 60 — a minute somebody
--                   was demonstrably there. From 2026-09-23 the client only
--                   pings while the tab is visible AND someone interacted in
--                   the last 5 minutes; before that a visible-but-idle tab
--                   still pinged, so historical active time is an UPPER bound.
--   seconds         kept as the tab-open span, and labelled that way.
-- Nothing in site_events is deleted or rewritten.
-- ============================================================================

drop function if exists public.admin_user_visits(uuid, integer);
create function public.admin_user_visits(p_user uuid, p_limit integer default 50)
returns table(session_id text, started_at timestamptz, ended_at timestamptz, seconds integer,
              events integer, device text, source text, first_path text, pages jsonb,
              views integer, active_seconds integer)
language sql stable security definer set search_path to 'public' as $$
  with ev as (
    select e.session_id, e.created_at, e.device, e.referrer_host, e.utm_source, e.path, e.kind
      from public.site_events e
     where public.is_admin() and e.user_id = p_user and e.session_id is not null
  ),
  per_page as (
    select session_id, path, count(*)::int as views, min(created_at) as first_at
      from ev
     where path is not null and kind = 'view'
     group by session_id, path
  )
  select
    ev.session_id::text,
    min(ev.created_at),
    max(ev.created_at),
    greatest(0, extract(epoch from (max(ev.created_at) - min(ev.created_at)))::int),
    count(*)::int,
    max(ev.device),
    coalesce(nullif(max(ev.referrer_host), ''), nullif(max(ev.utm_source), ''), 'Direct'),
    (array_agg(ev.path order by ev.created_at))[1],
    coalesce((
      select jsonb_agg(jsonb_build_object('path', p.path, 'views', p.views, 'at', p.first_at)
                       order by p.first_at)
        from per_page p
       where p.session_id = ev.session_id
    ), '[]'::jsonb),
    (count(*) filter (where ev.kind = 'view'))::int,
    (count(distinct date_trunc('minute', ev.created_at)) * 60)::int
  from ev
  group by ev.session_id
  order by min(ev.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;
revoke all on function public.admin_user_visits(uuid, integer) from public, anon;
grant execute on function public.admin_user_visits(uuid, integer) to authenticated;

create or replace function public.admin_user_summary(p_user uuid)
returns jsonb
language sql stable security definer set search_path to 'public' as $$
  with v as (
    select e.session_id,
           min(e.created_at) as started,
           max(e.created_at) as ended,
           count(*)::int     as events,
           (count(distinct date_trunc('minute', e.created_at)) * 60)::int as active
      from public.site_events e
     where e.user_id = p_user and e.session_id is not null
     group by e.session_id
  ),
  measured as (select * from v where ended > started)
  select case when not public.is_admin() then '{}'::jsonb else jsonb_build_object(
    'joined_at',      (select p.created_at from public.user_profile p where p.user_id = p_user),
    'last_visit_at',  (select max(ended) from v),
    'visits',         (select count(*)::int from v),
    'visits_unmeasurable', (select count(*)::int from v where ended <= started),
    -- The tab-open span, kept for continuity and labelled as such in the UI.
    'total_seconds',  coalesce((select sum(extract(epoch from (ended - started)))::int from measured), 0),
    'avg_seconds',    coalesce((select avg(extract(epoch from (ended - started)))::int from measured), 0),
    -- Minutes they were demonstrably there (see the header of this file).
    'active_seconds',     coalesce((select sum(active)::int from v), 0),
    'avg_active_seconds', coalesce((select avg(active)::int from v), 0),
    'events_total',   (select coalesce(sum(events), 0)::int from v),
    'page_views',     (select count(*)::int from public.site_events e
                        where e.user_id = p_user and e.kind = 'view'),
    'courses',        (select count(*)::int from public.courses c
                        where c.user_id = p_user and coalesce(c.archived, false) = false),
    'assignments',    (select count(*)::int from public.assignments a
                        where a.user_id = p_user and coalesce(a.deleted, false) = false),
    'parses',         (select count(*)::int from public.parse_events pe
                        where pe.user_id = p_user and pe.success),
    'tickets',        (select count(*)::int from public.tickets t where t.user_id = p_user),
    'first_seen',     (select min(started) from v)
  ) end;
$$;
