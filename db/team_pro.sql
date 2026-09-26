-- Pro for club teams. db/team_pro.sql. Idempotent; safe to re-run.
--
-- Anyone on a club's team (an active member, or the owner) has Pro, from the
-- moment they join until their last team membership ends. It is its OWN flag,
-- `user_profile.team_pro`, and never touches `plan_status`/`pro_until`:
--   - Stripe writes plan_status, so a lapsing subscription setting it back to
--     'free' cannot strip team Pro;
--   - leaving a team clears only team_pro, so a paid plan or a manual grant
--     always survives it.
-- "Is this account Pro" is ONE question, `ct_is_pro()`, and everything on the
-- server that gates on Pro asks it. Being on five teams changes nothing. Silent:
-- no notification or email is sent on grant or revoke.
--
-- A banned club does not confer Pro. Pending and approved clubs do.

alter table public.user_profile add column if not exists team_pro boolean not null default false;

create or replace function public.ct_team_pro_now(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.org_members m
      join public.organizations o on o.id = m.org_id
      where m.user_id = p_user and coalesce(m.status, 'active') = 'active'
        and coalesce(o.status, 'pending') <> 'banned')
    or exists (
      select 1 from public.organizations o
      where o.owner_id = p_user and coalesce(o.status, 'pending') <> 'banned')
$$;

create or replace function public.ct_sync_team_pro(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v boolean;
begin
  if p_user is null then return; end if;
  v := public.ct_team_pro_now(p_user);
  update public.user_profile set team_pro = v where user_id = p_user and team_pro is distinct from v;
end $$;
revoke all on function public.ct_sync_team_pro(uuid) from public, anon, authenticated;

create or replace function public.ct_team_pro_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Both ends of the row: the person who was on it and the person who is now.
  if tg_op <> 'INSERT' then perform public.ct_sync_team_pro(old.user_id); end if;
  if tg_op <> 'DELETE' then perform public.ct_sync_team_pro(new.user_id); end if;
  return coalesce(new, old);
end $$;

drop trigger if exists ct_team_pro_members on public.org_members;
create trigger ct_team_pro_members
  after insert or update or delete on public.org_members
  for each row execute function public.ct_team_pro_members();

-- Ownership moves, a club is banned or unbanned, or a club is deleted.
create or replace function public.ct_team_pro_orgs()
returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.ct_sync_team_pro(old.owner_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.ct_sync_team_pro(new.owner_id); end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    for u in select distinct m.user_id from public.org_members m where m.org_id = new.id and m.user_id is not null loop
      perform public.ct_sync_team_pro(u);
    end loop;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists ct_team_pro_orgs on public.organizations;
create trigger ct_team_pro_orgs
  after insert or update of owner_id, status or delete on public.organizations
  for each row execute function public.ct_team_pro_orgs();

-- ── The one Pro question ─────────────────────────────────────────────────
create or replace function public.ct_is_pro(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profile p
    where p.user_id = p_user
      and (p.plan_status = 'pro' or (p.pro_until is not null and p.pro_until > now()) or p.team_pro)
  )
$$;
grant execute on function public.ct_is_pro(uuid) to authenticated;

-- Same signature as before; now also team Pro.
create or replace function public.ct_parse_is_pro(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ct_is_pro(p_user)
$$;

create or replace function public.seat_watch_limit()
returns integer language sql stable security definer set search_path = public as $$
  select case when public.ct_is_pro(auth.uid())
    then 25   -- a sane ceiling even on Pro, so one account can't hammer the API
    else 1
  end
$$;

-- ── Admin: why does this account have Pro ────────────────────────────────
create or replace function public.admin_pro_sources()
returns table (user_id uuid, paid boolean, manual boolean, team_clubs text[])
language sql stable security definer set search_path = public as $$
  select p.user_id,
         (p.stripe_subscription_id is not null and p.subscription_status in ('active', 'trialing')) as paid,
         ((p.plan_status = 'pro' and not (p.stripe_subscription_id is not null and p.subscription_status in ('active', 'trialing')))
           or (p.pro_until is not null and p.pro_until > now())) as manual,
         coalesce((
           select array_agg(distinct o.name order by o.name)
           from public.organizations o
           where coalesce(o.status, 'pending') <> 'banned'
             and (o.owner_id = p.user_id
                  or exists (select 1 from public.org_members m
                             where m.org_id = o.id and m.user_id = p.user_id
                               and coalesce(m.status, 'active') = 'active'))
         ), '{}') as team_clubs
  from public.user_profile p
  where public.is_admin()
    and (p.team_pro or p.plan_status = 'pro' or (p.pro_until is not null and p.pro_until > now()))
$$;
grant execute on function public.admin_pro_sources() to authenticated;

-- ── Backfill, once: everyone already on a team ───────────────────────────
do $$
declare u uuid;
begin
  for u in
    select distinct m.user_id from public.org_members m where m.user_id is not null
    union
    select distinct o.owner_id from public.organizations o where o.owner_id is not null
  loop
    perform public.ct_sync_team_pro(u);
  end loop;
end $$;
