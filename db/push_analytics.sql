-- Push analytics (2026-11-10). Every push now writes a push_log row: admin
-- sends (api/admin.ts) and every automatic one (api/_run-reminders.ts: deadline
-- reminders, bell notifications, seat alerts, the trial notice, and the
-- founder's own admin alerts). The link carries ?pn=<id>, and opening it marks
-- opened_at (mark_push_opened). "Opened" = tapped into the app; a push read on
-- the lock screen and dismissed counts as not opened.
--
-- One function, admin-only, internal accounts excluded.

create index if not exists push_log_sent_idx on public.push_log (sent_at desc);
create index if not exists push_log_kind_idx on public.push_log (kind, sent_at desc);

create or replace function public.admin_push_analytics(p_days int default 30)
returns jsonb
language plpgsql security definer set search_path to 'public' stable as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;

  return (
    with people as (
      select user_id from public.user_profile where not coalesce(is_internal, false)
    ),
    subs as (
      select s.* from public.push_subscriptions s join people p using (user_id)
    ),
    log as (
      select l.* from public.push_log l join people p using (user_id)
       where l.sent_at >= v_since
    )
    select jsonb_build_object(
      'since', v_since,
      'reach', jsonb_build_object(
        'users', (select count(*) from people),
        'with_push', (select count(distinct user_id) from subs),
        'web', (select count(distinct user_id) from subs where coalesce(kind, 'web') = 'web'),
        'iphone', (select count(distinct user_id) from subs where kind = 'apns'),
        'devices', (select count(*) from subs),
        'new_in_period', (select count(distinct user_id) from subs where created_at >= v_since)
      ),
      'totals', jsonb_build_object(
        'sent', (select count(*) from log),
        'delivered', (select count(*) from log where delivered > 0),
        'opened', (select count(*) from log where opened_at is not null),
        'people_reached', (select count(distinct user_id) from log where delivered > 0),
        'median_open_minutes', (select percentile_cont(0.5) within group (order by extract(epoch from opened_at - sent_at) / 60)
                                  from log where opened_at is not null)
      ),
      'by_kind', (select coalesce(jsonb_agg(k order by k->>'sent' desc), '[]'::jsonb) from (
          select jsonb_build_object(
            'kind', kind, 'sent', count(*),
            'delivered', count(*) filter (where delivered > 0),
            'opened', count(*) filter (where opened_at is not null),
            'median_open_minutes', percentile_cont(0.5) within group (order by extract(epoch from opened_at - sent_at) / 60)
                                     filter (where opened_at is not null)
          ) k
          from log group by kind) x),
      'daily', (select coalesce(jsonb_agg(d order by d->>'day'), '[]'::jsonb) from (
          select jsonb_build_object(
            'day', to_char(g.day, 'YYYY-MM-DD'),
            'delivered', (select count(*) from log where delivered > 0 and (sent_at at time zone 'America/Montreal')::date = g.day),
            'opened', (select count(*) from log where opened_at is not null and (sent_at at time zone 'America/Montreal')::date = g.day)
          ) d
          from generate_series((v_since at time zone 'America/Montreal')::date, (now() at time zone 'America/Montreal')::date, interval '1 day') as g(day)) x),
      'by_hour', (select coalesce(jsonb_agg(h order by (h->>'hour')::int), '[]'::jsonb) from (
          select jsonb_build_object(
            'hour', extract(hour from sent_at at time zone 'America/Montreal')::int,
            'delivered', count(*) filter (where delivered > 0),
            'opened', count(*) filter (where opened_at is not null)
          ) h
          from log group by extract(hour from sent_at at time zone 'America/Montreal')) x),
      'sends', (select coalesce(jsonb_agg(s order by s->>'at' desc), '[]'::jsonb) from (
          select jsonb_build_object(
            'kind', kind, 'title', title, 'at', min(sent_at), 'people', count(*),
            'delivered', count(*) filter (where delivered > 0),
            'opened', count(*) filter (where opened_at is not null)
          ) s
          from log
          where kind in ('admin', 'bell', 'seat', 'trial')
          group by kind, title, date_trunc('hour', sent_at)
          order by min(sent_at) desc limit 40) x),
      'top_openers', (select coalesce(jsonb_agg(o order by (o->>'opened')::int desc), '[]'::jsonb) from (
          select jsonb_build_object(
            'user_id', l.user_id, 'name', p.name, 'handle', p.handle,
            'delivered', count(*) filter (where l.delivered > 0),
            'opened', count(*) filter (where l.opened_at is not null)
          ) o
          from log l join public.user_profile p on p.user_id = l.user_id
          where l.kind <> 'admin_alert'
          group by l.user_id, p.name, p.handle
          having count(*) filter (where l.delivered > 0) > 0
          order by count(*) filter (where l.opened_at is not null) desc, count(*) desc
          limit 15) x)
    )
  );
end $$;

revoke all on function public.admin_push_analytics(int) from public, anon;
grant execute on function public.admin_push_analytics(int) to authenticated;
