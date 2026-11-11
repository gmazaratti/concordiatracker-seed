-- What the Monday digest adds besides deadlines (2026-11-10):
--   my_events    campus events this week you said yes to: "Remind me"
--                (event_reminders) or "Add to my calendar" (a personal task
--                with the event's title at the event's start time).
--   suggested    up to 2 other events this week, from clubs you follow first,
--                then the ones most people asked to be reminded about. One per
--                recurring series, so a weekly night is not suggested twice.
--   unread       notifications you have not opened, and unread messages.
-- Service role only: the digest cron calls it per recipient.

create or replace function public.digest_extras(p_user uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
stable
as $$
  with wk as (select now() as a, now() + interval '7 days' as b),
  live as (
    select e.id, e.title, e.start, e.location, e.series_id, o.name as org, o.id as org_id
      from public.events e
      join public.organizations o on o.id = e.org_id and o.status = 'approved'
      cross join wk
     where not coalesce(e.is_draft, false) and e.start >= wk.a and e.start < wk.b
  ),
  mine as (
    select l.* from live l
     where exists (select 1 from public.event_reminders r where r.user_id = p_user and r.event_id = l.id)
        or exists (select 1 from public.todos t where t.user_id = p_user and t.title = l.title and t.due = l.start)
  ),
  ranked as (
    select distinct on (coalesce(l.series_id, l.id::text)) l.*,
           exists (select 1 from public.org_follows f where f.user_id = p_user and f.org_id = l.org_id) as followed,
           (select count(*) from public.event_reminders r where r.event_id = l.id) as interest
      from live l
     where l.id not in (select id from mine)
     order by coalesce(l.series_id, l.id::text), l.start
  ),
  suggested as (
    select * from ranked order by followed desc, interest desc, start limit 2
  )
  select jsonb_build_object(
    'my_events', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'start', start, 'location', location, 'org', org) order by start), '[]'::jsonb) from mine),
    'suggested', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'start', start, 'location', location, 'org', org, 'followed', followed) order by start), '[]'::jsonb) from suggested),
    'unread_notifications', (select count(*) from public.notifications n where n.user_id = p_user and n.read_at is null),
    'unread_messages', (select count(*) from public.messages m where m.recipient = p_user and m.read_at is null)
  )
$$;

revoke all on function public.digest_extras(uuid) from public, anon, authenticated;
grant execute on function public.digest_extras(uuid) to service_role;
