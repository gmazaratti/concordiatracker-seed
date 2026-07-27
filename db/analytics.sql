-- ── Site traffic analytics ───────────────────────────────────────────────────
-- First-party, anonymous traffic stats for the admin console. No third-party
-- tracker, no cookies, no IP storage, no cross-site identifiers.
--
-- PRIVACY (Law 25 / minors — same bar as the rest of the app):
--   • visitor_id / session_id are RANDOM ids generated in the browser. They
--     identify a browser, never a person, and carry no personal data.
--   • Only the referrer HOST is stored ("instagram.com"), never the full URL,
--     which can carry personal data in its query string.
--   • Paths are NORMALIZED client-side before they're sent — invite tokens and
--     ids become ':token' / ':id', so a single-use invite secret can never land
--     in this table.
--   • No IP address, no user-agent string, no fingerprinting.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create table if not exists public.site_events (
  id            bigserial primary key,
  -- Per-tab (sessionStorage) — drives "online right now".
  session_id    text not null,
  -- Per-browser (localStorage) — drives new vs returning.
  visitor_id    text not null,
  -- Set only when the visitor happens to be signed in.
  user_id       uuid references auth.users (id) on delete set null,
  kind          text not null default 'view',   -- 'view' | 'ping'
  path          text not null,                  -- normalized route, never raw
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  device        text,                           -- 'mobile' | 'desktop'
  created_at    timestamptz not null default now()
);

create index if not exists site_events_created_idx  on public.site_events (created_at desc);
create index if not exists site_events_session_idx  on public.site_events (session_id, created_at desc);
create index if not exists site_events_visitor_idx  on public.site_events (visitor_id, created_at);

alter table public.site_events enable row level security;

-- Anyone may RECORD a visit (including signed-out visitors on the landing page).
-- Nobody may read: stats come from the admin-gated rollup below.
drop policy if exists "site_events insert" on public.site_events;
create policy "site_events insert" on public.site_events
  for insert to anon, authenticated with check (true);

grant insert on public.site_events to anon, authenticated;
grant usage, select on sequence public.site_events_id_seq to anon, authenticated;

-- ── Admin rollup ─────────────────────────────────────────────────────────────
create or replace function public.admin_traffic_stats(p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r      jsonb;
  d      int := greatest(1, least(coalesce(p_days, 30), 365));
  since  timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select jsonb_build_object(
    -- Distinct tabs active in the last 5 minutes.
    'live_now', (
      select count(distinct session_id) from site_events
      where created_at > now() - interval '5 minutes'
    ),
    'today_visitors', (
      select count(distinct visitor_id) from site_events
      where created_at >= date_trunc('day', now())
    ),
    'today_views', (
      select count(*) from site_events
      where kind = 'view' and created_at >= date_trunc('day', now())
    ),
    'window_visitors', (
      select count(distinct visitor_id) from site_events where created_at >= since
    ),
    'window_views', (
      select count(*) from site_events where kind = 'view' and created_at >= since
    ),
    'window_days', d,
    -- Visitors whose very first event ever falls inside the window.
    'new_visitors', (
      select count(*) from (
        select visitor_id, min(created_at) as first_seen
        from site_events group by visitor_id
      ) f where f.first_seen >= since
    ),
    'signed_in_visitors', (
      select count(distinct visitor_id) from site_events
      where created_at >= since and user_id is not null
    ),
    -- Where they came from.
    'referrers', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(nullif(referrer_host, ''), 'direct') as source,
               count(distinct visitor_id) as visitors
        from site_events where created_at >= since
        group by 1 order by 2 desc limit 12
      ) x
    ),
    -- Campaign tags (?utm_source=instagram etc.)
    'campaigns', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select utm_source as source, coalesce(utm_campaign, '—') as campaign,
               count(distinct visitor_id) as visitors
        from site_events
        where created_at >= since and coalesce(utm_source, '') <> ''
        group by 1, 2 order by 3 desc limit 12
      ) x
    ),
    'top_pages', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct visitor_id) as visitors
        from site_events
        where kind = 'view' and created_at >= since
        group by 1 order by 2 desc limit 12
      ) x
    ),
    'devices', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(device, 'unknown') as device,
               count(distinct visitor_id) as visitors
        from site_events where created_at >= since
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
        left join site_events e
          on e.created_at >= g.day and e.created_at < g.day + interval '1 day'
        group by g.day
      ) x
    )
  ) into r;
  return r;
end $$;
grant execute on function public.admin_traffic_stats(int) to authenticated;

-- ── Retention ────────────────────────────────────────────────────────────────
-- Heartbeats add ~1 row/minute per open tab, so old rows are pruned. Keep views
-- for 180 days (useful history), pings for 7 (only ever needed for "live now").
create or replace function public.prune_site_events()
returns void language sql security definer set search_path = public as $$
  delete from public.site_events
   where (kind = 'ping' and created_at < now() - interval '7 days')
      or (created_at < now() - interval '180 days');
$$;

-- Optional daily prune (pg_cron is already enabled for reminders):
--   select cron.schedule('prune-site-events', '30 4 * * *',
--                        $$select public.prune_site_events()$$);
