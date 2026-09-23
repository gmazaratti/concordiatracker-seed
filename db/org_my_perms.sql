-- ============================================================================
-- org_my_perms.sql — "what may I do here", answered by the same function every
-- write policy asks.
--
-- The portal gated its tabs on the LEGACY three-value column (owner / admin /
-- member) plus a per-person override, so somebody on a custom role — a
-- Secretary holding manage_team — saw a Member's portal while the database
-- would have let them do more. Asking `org_perm` for every key means the
-- screen and the policies cannot disagree; the screen is still only a hint.
-- ============================================================================
create or replace function public.my_org_perms(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_object_agg(k, public.org_perm(p_org, k))
         || jsonb_build_object(
              'view_activity', public.ct_org_can_view_activity(p_org),
              'is_owner',      public.ct_org_is_owner(p_org),
              'position',      public.ct_org_position(p_org))
    from unnest(public.ct_org_perm_keys()) k;
$$;
revoke all on function public.my_org_perms(uuid) from public;
grant execute on function public.my_org_perms(uuid) to authenticated;
