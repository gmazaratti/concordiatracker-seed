-- ─────────────────────────────────────────────────────────────────────────────
-- Admin → Attribution: signups and visitors per source link (/r = reddit).
--
-- Reads what db/ref_source.sql records:
--   user_profile.signup_ref  set once, when the account was created
--   site_events.ref          set on every analytics event while the cookie lives
--
-- Internal / test accounts are excluded from both counts, the rule everywhere
-- in the admin console. Visitors are DISTINCT browsers (visitor_id), so one
-- person reloading the page is one visitor.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_ref_attribution()
returns jsonb
language sql stable security definer set search_path = public as $$
  with refs as (
    select signup_ref as ref from public.user_profile where signup_ref is not null
    union
    select ref from public.site_events where ref is not null
  ),
  internal_visitors as (
    select distinct e.visitor_id
      from public.site_events e
      join public.user_profile p on p.user_id = e.user_id
     where coalesce(p.is_internal, false)
  )
  select case when not public.is_admin() then '[]'::jsonb else coalesce((
    select jsonb_agg(row_to_json(x) order by x.signups desc, x.visitors desc)
      from (
        select r.ref,
               (select count(*) from public.user_profile p
                 where p.signup_ref = r.ref and not coalesce(p.is_internal, false))::int as signups,
               (select count(distinct e.visitor_id) from public.site_events e
                 where e.ref = r.ref
                   and e.visitor_id not in (select visitor_id from internal_visitors where visitor_id is not null))::int as visitors,
               (select max(p.created_at) from public.user_profile p
                 where p.signup_ref = r.ref and not coalesce(p.is_internal, false)) as last_signup_at
          from refs r
      ) x
  ), '[]'::jsonb) end
$$;

grant execute on function public.admin_ref_attribution() to authenticated;
