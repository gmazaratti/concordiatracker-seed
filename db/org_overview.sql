-- ============================================================================
-- Two read-only functions for the organizer portal.
--
-- 1. `org_daily_series` — what the Overview charts are drawn from.
--    WHY THESE COLUMNS AND NOT "VIEWS": there is no view tracking for a real
--    club (Insights says so on its own page). Everything here is a row that
--    already exists with a timestamp on it — a follow, a post, a like, a
--    comment, a published event — so the chart is a count of real things on
--    real days, never an estimate.
--    AGGREGATE ONLY. It returns numbers per day and nothing that identifies a
--    student; `org_follows` is select-own precisely so a club cannot list its
--    followers, and a definer that handed back names would undo that.
--    Days are Montreal days: a like at 11pm belongs to the evening it
--    happened in, not to tomorrow in UTC.
--
-- 2. `org_member_activity` — one teammate's recent actions, for the member
--    panel. Gated on the SAME check as the Activity tab, so a role that
--    cannot read the log cannot read it one person at a time either.
-- ============================================================================

create or replace function public.org_daily_series(p_org uuid, p_days int default 30)
returns table (
  day date,
  followers int,
  new_followers int,
  posts int,
  likes int,
  comments int,
  events int
)
language sql
stable security definer
set search_path to 'public'
as $$
  with bounds as (
    select (now() at time zone 'America/Montreal')::date as today,
           greatest(7, least(coalesce(p_days, 30), 180)) as n
  ),
  span as (
    select generate_series(b.today - (b.n - 1), b.today, interval '1 day')::date as day
      from bounds b
  ),
  f as (
    select (created_at at time zone 'America/Montreal')::date as d
      from public.org_follows where org_id = p_org
  ),
  p as (
    select id, (created_at at time zone 'America/Montreal')::date as d
      from public.org_posts
     where org_id = p_org and not deleted and not is_draft
  )
  select s.day,
         (select count(*)::int from f where f.d <= s.day),
         (select count(*)::int from f where f.d = s.day),
         (select count(*)::int from p where p.d = s.day),
         (select count(*)::int from public.post_likes l join p on p.id = l.post_id
           where (l.created_at at time zone 'America/Montreal')::date = s.day),
         (select count(*)::int from public.post_comments c join p on p.id = c.post_id
           where not c.deleted
             and (c.created_at at time zone 'America/Montreal')::date = s.day),
         (select count(*)::int from public.events e
           where e.org_id = p_org and not e.is_draft
             and (coalesce(e.posted_at, e.created_at) at time zone 'America/Montreal')::date = s.day)
    from span s
   where public.ct_is_org_member(p_org) or public.is_admin()
   order by s.day;
$$;
grant execute on function public.org_daily_series(uuid, int) to authenticated;

create or replace function public.org_member_activity(
  p_org uuid, p_actor uuid, p_limit int default 5, p_offset int default 0)
returns table (id uuid, created_at timestamptz, action text, detail text, reverted_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $$
  select a.id, a.created_at, a.action, a.detail, a.reverted_at
    from public.org_activity a
   where a.org_id = p_org
     and a.actor_user = p_actor
     and public.ct_org_can_view_activity(p_org)
   order by a.created_at desc
   limit greatest(1, least(coalesce(p_limit, 5), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.org_member_activity(uuid, uuid, int, int) to authenticated;
