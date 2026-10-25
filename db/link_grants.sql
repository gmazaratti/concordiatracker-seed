-- Signup grants from promo links: concordiatracker.com/l (LinkedIn) gives a
-- brand-new account 14 days of Pro, no card.
--
-- THE GRANT IS A TIME-LIMITED pro_until, the same column admin grants and the
-- survey reward use, so it expires on its own and touches nothing in billing:
-- plan_status, Stripe columns and iap_* are never written here.
--
-- EVERY GUARD IS IN THE FUNCTION, not the client, because the client only says
-- "I just signed up"; the database decides whether that is true:
--   * the source is read from user_profile.signup_ref, written once at profile
--     creation and immutable afterwards (ct_guard_profile_privileged), never
--     from an argument;
--   * the account must be new: auth.users.created_at within 2 hours;
--   * no active Stripe subscription, no live Apple purchase, not already Pro by
--     any route (plan_status, team, a running pro_until);
--   * one grant per account, ever: signup_grants.user_id is the primary key.
-- A refusal returns a reason and changes nothing.

create table if not exists public.signup_grants (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  source     text not null check (source ~ '^[a-z0-9_-]{1,32}$'),
  granted_at timestamptz not null default now(),
  pro_until  timestamptz not null
);
alter table public.signup_grants enable row level security;
drop policy if exists signup_grants_select_own on public.signup_grants;
create policy signup_grants_select_own on public.signup_grants for select to authenticated
  using (user_id = auth.uid());
grant select on public.signup_grants to authenticated;
create index if not exists signup_grants_source_idx on public.signup_grants (source, granted_at);

-- Which link sources carry a grant, and how long. Add a row to add a link.
create or replace function public.ct_signup_grant_days(p_source text)
returns int language sql immutable as $$
  select case p_source when 'linkedin-l' then 14 else null end
$$;

create or replace function public.claim_signup_grant()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_src text; v_days int; v_created timestamptz; v_until timestamptz;
  p public.user_profile%rowtype;
begin
  if v_me is null then return jsonb_build_object('granted', false, 'reason', 'signed_out'); end if;
  -- Serialise two tabs claiming at once; the primary key is the backstop.
  perform pg_advisory_xact_lock(hashtext('signup_grant:' || v_me::text));

  if exists (select 1 from public.signup_grants g where g.user_id = v_me) then
    return jsonb_build_object('granted', false, 'reason', 'already_granted');
  end if;

  select * into p from public.user_profile where user_id = v_me;
  if not found then return jsonb_build_object('granted', false, 'reason', 'no_profile'); end if;
  v_src := p.signup_ref;
  v_days := public.ct_signup_grant_days(v_src);
  if v_days is null then return jsonb_build_object('granted', false, 'reason', 'no_eligible_source'); end if;

  select u.created_at into v_created from auth.users u where u.id = v_me;
  if v_created is null or v_created < now() - interval '2 hours' then
    return jsonb_build_object('granted', false, 'reason', 'not_a_new_account');
  end if;

  if p.subscription_status in ('active', 'trialing', 'past_due')
     or (p.iap_expires_at is not null and p.iap_expires_at > now())
     or p.plan_status = 'pro'
     or coalesce(p.team_pro, false)
     or (p.pro_until is not null and p.pro_until > now()) then
    return jsonb_build_object('granted', false, 'reason', 'already_pro');
  end if;

  v_until := v_created + make_interval(days => v_days);
  insert into public.signup_grants (user_id, source, pro_until) values (v_me, v_src, v_until);
  update public.user_profile
     set pro_until = v_until,
         -- The existing gift celebration tells them, as for an admin grant.
         pro_gift_pending = true,
         pro_gift_by = coalesce(pro_gift_by, 'the ConcordiaTracker team')
   where user_id = v_me;
  return jsonb_build_object('granted', true, 'source', v_src, 'pro_until', v_until);
exception when others then
  -- A grant is a bonus; it must never break a signup.
  return jsonb_build_object('granted', false, 'reason', 'error');
end $$;
revoke all on function public.claim_signup_grant() from public, anon;
grant execute on function public.claim_signup_grant() to authenticated;

-- Admin count: signups and grants per link source.
create or replace function public.admin_signup_grant_counts()
returns table (source text, signups bigint, grants bigint, active_grants bigint)
language sql stable security definer set search_path = public as $$
  select s.source,
         (select count(*) from public.user_profile up
           where up.signup_ref = s.source and not coalesce(up.is_internal, false)),
         count(g.user_id),
         count(g.user_id) filter (where g.pro_until > now())
    from (select 'linkedin-l'::text as source) s
    left join public.signup_grants g on g.source = s.source
   where public.is_admin()
   group by s.source
$$;
revoke all on function public.admin_signup_grant_counts() from public, anon;
grant execute on function public.admin_signup_grant_counts() to authenticated;
