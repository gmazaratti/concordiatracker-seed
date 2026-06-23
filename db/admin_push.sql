-- ============================================================================
-- Admin activity PUSH — a digest notification on top of the in-app inbox.
--
-- The existing reminder cron (every ~15 min → /api/run-reminders) also calls
-- admin_activity_digests(): for each admin, it counts activity that arrived
-- since their last push, stamps activity_pushed_at = now() (so it won't resend),
-- and the endpoint sends ONE consolidated push to that admin's devices.
--
-- Service-role only (the cron) — never exposed to regular users.
-- ============================================================================

alter table public.admins
  add column if not exists activity_pushed_at timestamptz;

-- Start the clock now so existing history doesn't trigger a giant first push.
update public.admins set activity_pushed_at = now() where activity_pushed_at is null;

create or replace function public.admin_activity_digests()
returns table (user_id uuid, total int, users int, features int, bugs int, applications int)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with computed as (
    select adm.user_id, coalesce(adm.activity_pushed_at, 'epoch'::timestamptz) as since
      from public.admins adm
  ),
  counts as (
    select c.user_id,
      (select count(*) from public.user_profile up
         where up.user_id <> c.user_id and up.created_at > c.since) as users,
      (select count(*) from public.feature_requests fr
         where fr.hidden = false and fr.created_at > c.since) as features,
      (select count(*) from public.bug_reports br
         where br.created_at > c.since) as bugs,
      ((select count(*) from public.access_requests ar
          where ar.status = 'pending' and ar.created_at > c.since)
       + (select count(*) from public.organizations o
          where o.status = 'pending' and o.created_at > c.since)
       + (select count(*) from public.teacher_accounts tc
          where tc.status = 'pending' and tc.created_at > c.since)) as applications
    from computed c
  ),
  -- Claim (stamp) the admins we're about to notify so the next run won't resend.
  -- A data-modifying CTE always runs; the reads above use the pre-update snapshot.
  stamped as (
    update public.admins adm set activity_pushed_at = now()
    from counts ct
    where adm.user_id = ct.user_id
      and (ct.users + ct.features + ct.bugs + ct.applications) > 0
    returning adm.user_id
  )
  select ct.user_id,
    (ct.users + ct.features + ct.bugs + ct.applications)::int as total,
    ct.users::int, ct.features::int, ct.bugs::int, ct.applications::int
  from counts ct
  where (ct.users + ct.features + ct.bugs + ct.applications) > 0;
end; $$;

revoke all on function public.admin_activity_digests() from public, anon, authenticated;
grant execute on function public.admin_activity_digests() to service_role;
