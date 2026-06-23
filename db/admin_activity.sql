-- ============================================================================
-- Admin activity feed — a personal "inbox" for the platform admin: new users,
-- feature requests, bug reports, and pending applications (access requests, new
-- orgs, teacher claims), unioned + sorted newest-first, with an unseen marker.
--
-- Admin-only via is_admin(). "Last seen" lives on the admins table, so the badge
-- only counts activity that arrived after the admin last opened the feed.
-- ============================================================================

alter table public.admins
  add column if not exists activity_seen_at timestamptz;

-- Start the clock now, so existing history doesn't all show up as "unseen".
update public.admins set activity_seen_at = now() where activity_seen_at is null;

-- Returns { seen_at, items: [{kind,id,title,subtitle,created_at}, …] } (≤50, newest first).
create or replace function public.admin_activity_feed()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  seen  timestamptz;
  items jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select activity_seen_at into seen from public.admins where user_id = auth.uid();

  with recent as (
    select 'user'::text as kind, up.user_id::text as id,
           coalesce(up.name, up.email, 'New student') as title,
           coalesce(up.email, '') as subtitle, up.created_at
      from public.user_profile up
      where up.user_id <> auth.uid()
    union all
    select 'feature', fr.id::text, fr.title,
           fr.author_name || ' · feature request', fr.created_at
      from public.feature_requests fr where fr.hidden = false
    union all
    select 'bug', br.id::text, br.title,
           coalesce(br.user_email, 'someone') || ' · bug report', br.created_at
      from public.bug_reports br
    union all
    select 'request', ar.case_id, ar.name || ' — ' || ar.role || ' access',
           ar.email, ar.created_at
      from public.access_requests ar where ar.status = 'pending'
    union all
    select 'org', o.id::text, o.name || ' — new organization',
           '@' || o.handle, o.created_at
      from public.organizations o where o.status = 'pending'
    union all
    select 'teacher', tc.id::text, tc.name || ' — teacher access',
           tc.email, tc.created_at
      from public.teacher_accounts tc where tc.status = 'pending'
  )
  select jsonb_agg(to_jsonb(r) order by r.created_at desc)
    into items
    from (select * from recent order by created_at desc limit 50) r;

  return jsonb_build_object('seen_at', seen, 'items', coalesce(items, '[]'::jsonb));
end; $$;

-- Mark everything up to now as seen (clears the unseen badge).
create or replace function public.admin_mark_activity_seen()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.admins set activity_seen_at = now() where user_id = auth.uid();
end; $$;

grant execute on function public.admin_activity_feed() to authenticated;
grant execute on function public.admin_mark_activity_seen() to authenticated;
