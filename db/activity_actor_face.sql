-- ============================================================================
-- The activity log names its actors properly — including the platform admin.
--
-- A row found its actor's photo and role by looking them up in the club's
-- team list. That works for a member and fails for anybody who acts WITHOUT a
-- member row: the platform admin (who reaches every club through is_admin())
-- and an owner recorded only in organizations.owner_id. On @concordia.president
-- — no owner, no team — every one of Alex's entries rendered as grey initials
-- with no role, which is what was reported.
--
-- So the feed now carries two more facts it already knows:
--   actor_avatar  the actor's own profile photo
--   actor_rank    'owner' when they own the club, 'admin' when they acted as
--                 the platform, null when they are simply on the team (the
--                 client then reads their role off the team list as before).
--
-- A return type cannot be widened by CREATE OR REPLACE, so it is dropped
-- first. Body otherwise identical to the live function.
-- ============================================================================

drop function if exists public.org_activity_feed(uuid, integer);
create function public.org_activity_feed(p_org uuid, p_limit integer default 100)
returns table (
  id uuid, created_at timestamptz, actor_user uuid, actor_name text, actor_email text,
  action text, detail text, entity_type text, entity_id text, reverted_at timestamptz,
  can_revert boolean, actor_avatar text, actor_rank text
)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.created_at, a.actor_user, a.actor_name, a.actor_email,
         a.action, a.detail, a.entity_type, a.entity_id, a.reverted_at,
         public.ct_activity_revertible(a)
           and (public.ct_org_is_owner(p_org) or public.org_perm(p_org, 'roles_grant')),
         p.avatar_url,
         case
           when a.actor_user is not null and a.actor_user = o.owner_id then 'owner'
           when a.actor_user is not null
                and exists (select 1 from public.admins ad where ad.user_id = a.actor_user)
                and not exists (select 1 from public.org_members m
                                 where m.org_id = p_org and m.user_id = a.actor_user
                                   and coalesce(m.status, 'active') = 'active')
             then 'admin'
           else null
         end
    from public.org_activity a
    join public.organizations o on o.id = a.org_id
    left join public.user_profile p on p.user_id = a.actor_user
   where a.org_id = p_org
     and public.ct_org_can_view_activity(p_org)
   order by a.created_at desc
   limit least(coalesce(p_limit, 100), 500);
$$;

revoke all on function public.org_activity_feed(uuid, integer) from public, anon;
grant execute on function public.org_activity_feed(uuid, integer) to authenticated;
