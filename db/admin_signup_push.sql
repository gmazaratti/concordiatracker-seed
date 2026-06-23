-- ============================================================================
-- Signups → individual pushes (name + email). The digest function now also
-- returns the new users themselves (not just a count) so the endpoint can send
-- one notification per signup; feedback / feature requests / applications stay
-- a single consolidated digest. Re-run safe (drops + recreates the function).
--
-- Requires db/admin_push.sql (the activity_pushed_at column) already applied.
-- ============================================================================

drop function if exists public.admin_activity_digests();

create or replace function public.admin_activity_digests()
returns table (user_id uuid, features int, bugs int, applications int, new_users jsonb)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with computed as (
    select adm.user_id, coalesce(adm.activity_pushed_at, 'epoch'::timestamptz) as since
      from public.admins adm
  ),
  data as (
    select c.user_id,
      (select count(*) from public.feature_requests fr
         where fr.hidden = false and fr.created_at > c.since) as features,
      (select count(*) from public.bug_reports br
         where br.created_at > c.since) as bugs,
      ((select count(*) from public.access_requests ar
          where ar.status = 'pending' and ar.created_at > c.since)
       + (select count(*) from public.organizations o
          where o.status = 'pending' and o.created_at > c.since)
       + (select count(*) from public.teacher_accounts tc
          where tc.status = 'pending' and tc.created_at > c.since)) as applications,
      (select coalesce(
          jsonb_agg(jsonb_build_object(
            'name',  coalesce(up.name, up.email, 'New user'),
            'email', coalesce(up.email, '')
          ) order by up.created_at), '[]'::jsonb)
        from public.user_profile up
        where up.user_id <> c.user_id and up.created_at > c.since) as new_users
    from computed c
  ),
  -- Claim (stamp) admins with anything pending so the next run won't resend.
  stamped as (
    update public.admins adm set activity_pushed_at = now()
    from data d
    where adm.user_id = d.user_id
      and (d.features + d.bugs + d.applications + jsonb_array_length(d.new_users)) > 0
    returning adm.user_id
  )
  select d.user_id, d.features::int, d.bugs::int, d.applications::int, d.new_users
  from data d
  where (d.features + d.bugs + d.applications + jsonb_array_length(d.new_users)) > 0;
end; $$;

revoke all on function public.admin_activity_digests() from public, anon, authenticated;
grant execute on function public.admin_activity_digests() to service_role;
