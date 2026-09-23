-- ============================================================================
-- Internal accounts leave the Traffic tab too.
--
-- The overview counts and the daily chart already excluded is_internal
-- accounts; the Traffic tab read site_events raw, so staff, probes and
-- Alfred's QA account counted as visitors. ct_real_site_events() is the one
-- definition of "events from real people": it drops every event from a
-- BROWSER (visitor_id) that has ever been signed in as an internal account,
-- which also removes that browser's signed-out page loads.
-- Nothing in site_events is deleted.
-- ============================================================================

create or replace function public.ct_real_site_events()
returns setof public.site_events
language sql stable security definer set search_path = public as $$
  select e.* from public.site_events e
   where e.visitor_id is null or e.visitor_id not in (
     select distinct x.visitor_id from public.site_events x
       join public.user_profile p on p.user_id = x.user_id
      where coalesce(p.is_internal, false) and x.visitor_id is not null
   )
$$;
revoke all on function public.ct_real_site_events() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_traffic_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r      jsonb;
  d      int := greatest(1, least(coalesce(p_days, 30), 365));
  since  timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select jsonb_build_object(
    -- Distinct tabs active in the last 5 minutes.
    'live_now', (
      select count(distinct session_id) from public.ct_real_site_events()
      where created_at > now() - interval '5 minutes'
    ),
    'today_visitors', (
      select count(distinct visitor_id) from public.ct_real_site_events()
      where created_at >= date_trunc('day', now())
    ),
    'today_views', (
      select count(*) from public.ct_real_site_events()
      where kind = 'view' and created_at >= date_trunc('day', now())
    ),
    'window_visitors', (
      select count(distinct visitor_id) from public.ct_real_site_events() where created_at >= since
    ),
    'window_views', (
      select count(*) from public.ct_real_site_events() where kind = 'view' and created_at >= since
    ),
    'window_days', d,
    -- Visitors whose very first event ever falls inside the window.
    'new_visitors', (
      select count(*) from (
        select visitor_id, min(created_at) as first_seen
        from public.ct_real_site_events() group by visitor_id
      ) f where f.first_seen >= since
    ),
    'signed_in_visitors', (
      select count(distinct visitor_id) from public.ct_real_site_events()
      where created_at >= since and user_id is not null
    ),
    -- Where they came from.
    'referrers', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(nullif(referrer_host, ''), 'direct') as source,
               count(distinct visitor_id) as visitors
        from public.ct_real_site_events() where created_at >= since
        group by 1 order by 2 desc limit 12
      ) x
    ),
    -- Campaign tags (?utm_source=instagram etc.)
    'campaigns', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select utm_source as source, coalesce(utm_campaign, '—') as campaign,
               count(distinct visitor_id) as visitors
        from public.ct_real_site_events()
        where created_at >= since and coalesce(utm_source, '') <> ''
        group by 1, 2 order by 3 desc limit 12
      ) x
    ),
    'top_pages', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct visitor_id) as visitors
        from public.ct_real_site_events()
        where kind = 'view' and created_at >= since
        group by 1 order by 2 desc limit 12
      ) x
    ),
    'devices', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(device, 'unknown') as device,
               count(distinct visitor_id) as visitors
        from public.ct_real_site_events() where created_at >= since
        group by 1 order by 2 desc
      ) x
    ),
    -- Daily series for the chart (zero-filled so gaps don't distort it).
    'daily', (
      select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
        select to_char(g.day, 'YYYY-MM-DD') as day,
               count(distinct e.visitor_id) as visitors,
               count(e.id) filter (where e.kind = 'view') as views
        from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') g(day)
        left join public.ct_real_site_events() e
          on e.created_at >= g.day and e.created_at < g.day + interval '1 day'
        group by g.day
      ) x
    )
  ) into r;
  return r;
end $function$;
