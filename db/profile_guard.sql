-- Lock the privileged columns of user_profile against the person themselves.
--
-- MEASURED BEFORE THIS FILE (live audit, 2026-09-26): a signed-in non-admin
-- PATCHed their own row and stored plan_status = 'pro', subscription_status,
-- pro_until, comped, team_pro, is_internal, admin_notes and
-- can_upload_blueprints. The UPDATE policy only checks the row is yours, and
-- `authenticated` holds UPDATE on every column.
--
-- A TRIGGER, NOT A COLUMN REVOKE. It checks current_user: a request from the
-- app runs as `authenticated` (or `anon`), while every legitimate writer of
-- these columns (the Stripe webhook with the service role, admin_set_plan and
-- the other SECURITY DEFINER functions, which run as their owner) runs as
-- something else. It is deliberately NOT security definer: inside a definer,
-- current_user is the owner and the check would pass everything.
--
-- UPDATE: a change to a locked column is refused. INSERT (a new account's own
-- row): locked columns are reset to their column defaults instead of refused,
-- so a sign-up can never be blocked; sign-up attribution may be written on
-- insert and is locked afterwards.
--
-- Also here: admin notes move to an admin-only table (their subject could read
-- them on their own row); the Pro grant re-arms the gift celebration (a later
-- version of admin_set_plan had dropped that); user_profile joins the Realtime
-- publication so the celebration fires without a refresh (profile_select_own
-- means Realtime only ever delivers a person their own row).
--
-- Idempotent: safe to re-run.

-- -- Admin notes, out of the row their subject can read --------------------
create table if not exists public.admin_user_notes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.admin_user_notes enable row level security;
revoke all on public.admin_user_notes from anon, authenticated;
insert into public.admin_user_notes (user_id, notes)
  select user_id, admin_notes from public.user_profile where admin_notes is not null and admin_notes <> ''
  on conflict (user_id) do update set notes = excluded.notes, updated_at = now();

create or replace function public.admin_set_user_notes(p_uid uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.admin_user_notes (user_id, notes, updated_at) values (p_uid, p_notes, now())
  on conflict (user_id) do update set notes = excluded.notes, updated_at = now();
end $$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(user_id uuid, name text, email text, created_at timestamp with time zone, role text, plan_status text, plan_expires_at timestamp with time zone, admin_notes text, can_upload_blueprints boolean, vanity_code text, referred_by_code text, course_count bigint, assignment_count bigint, following_count bigint, signups_attributed bigint, is_internal boolean, comped boolean, stripe_customer_id text, subscription_status text, last_seen_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select p.user_id, p.name, p.email, p.created_at, p.role,
           p.plan_status, p.plan_expires_at, (select n.notes from public.admin_user_notes n where n.user_id = p.user_id),
           coalesce(p.can_upload_blueprints, true), p.vanity_code, p.referred_by_code,
           (select count(*) from public.courses c where c.user_id = p.user_id),
           (select count(*) from public.assignments a where a.user_id = p.user_id and coalesce(a.deleted,false) = false),
           (select count(*) from public.org_follows f where f.user_id = p.user_id),
           (select count(*) from public.user_profile r where r.referred_by_code is not null and r.referred_by_code = p.vanity_code),
           coalesce(p.is_internal, false), coalesce(p.comped, false),
           p.stripe_customer_id, p.subscription_status,
           (select max(e.created_at) from public.site_events e where e.user_id = p.user_id)
    from public.user_profile p
    order by p.created_at desc;
end; $function$;

-- Cleared only after the readers above point at the new table.
update public.user_profile set admin_notes = null where admin_notes is not null;

-- -- The guard ---------------------------------------------------------------
create or replace function public.ct_guard_profile_privileged()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'UPDATE' then
    if new.admin_notes is distinct from old.admin_notes or
       new.can_upload_blueprints is distinct from old.can_upload_blueprints or
       new.cancel_at_period_end is distinct from old.cancel_at_period_end or
       new.comped is distinct from old.comped or
       new.current_period_end is distinct from old.current_period_end or
       new.is_internal is distinct from old.is_internal or
       new.plan_expires_at is distinct from old.plan_expires_at or
       new.plan_price_id is distinct from old.plan_price_id or
       new.plan_status is distinct from old.plan_status or
       new.pro_gift_by is distinct from old.pro_gift_by or
       new.pro_gift_pending is distinct from old.pro_gift_pending or
       new.pro_until is distinct from old.pro_until or
       new.role is distinct from old.role or
       new.stripe_customer_id is distinct from old.stripe_customer_id or
       new.stripe_subscription_id is distinct from old.stripe_subscription_id or
       new.subscription_amount_cents is distinct from old.subscription_amount_cents or
       new.subscription_interval_months is distinct from old.subscription_interval_months or
       new.subscription_price_id is distinct from old.subscription_price_id or
       new.subscription_status is distinct from old.subscription_status or
       new.team_pro is distinct from old.team_pro or
       new.trial_end is distinct from old.trial_end or
       new.trial_reminder_for is distinct from old.trial_reminder_for or
       new.vanity_code is distinct from old.vanity_code or
       new.referred_by_code is distinct from old.referred_by_code or
       new.signup_ref is distinct from old.signup_ref or
       new.signup_channel is distinct from old.signup_channel or
       new.signup_utm_source is distinct from old.signup_utm_source or
       new.signup_utm_medium is distinct from old.signup_utm_medium or
       new.signup_utm_campaign is distinct from old.signup_utm_campaign or
       new.signup_referrer_host is distinct from old.signup_referrer_host or
       new.signup_landing_path is distinct from old.signup_landing_path or
       new.first_seen_at is distinct from old.first_seen_at then
      raise exception 'That field can only be changed by ConcordiaTracker.' using errcode = '42501';
    end if;
    return new;
  end if;
  new.admin_notes := null;
  new.can_upload_blueprints := true;
  new.cancel_at_period_end := false;
  new.comped := false;
  new.current_period_end := null;
  new.is_internal := false;
  new.plan_expires_at := null;
  new.plan_price_id := null;
  new.plan_status := 'free'::text;
  new.pro_gift_by := null;
  new.pro_gift_pending := false;
  new.pro_until := null;
  new.role := 'student'::text;
  new.stripe_customer_id := null;
  new.stripe_subscription_id := null;
  new.subscription_amount_cents := null;
  new.subscription_interval_months := null;
  new.subscription_price_id := null;
  new.subscription_status := null;
  new.team_pro := false;
  new.trial_end := null;
  new.trial_reminder_for := null;
  new.vanity_code := null;
  return new;
end $$;
revoke all on function public.ct_guard_profile_privileged() from public, anon, authenticated;
drop trigger if exists ct_guard_profile_privileged on public.user_profile;
create trigger ct_guard_profile_privileged before insert or update on public.user_profile
  for each row execute function public.ct_guard_profile_privileged();

-- -- The grant arms the celebration again ------------------------------------
create or replace function public.admin_set_plan(p_target uuid, p_pro boolean, p_reason text, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare before jsonb; was_pro boolean; granter text;
begin
  if not public.is_admin() then raise exception 'Not authorized.'; end if;
  select to_jsonb(x) into before from (
    select p.plan_status, p.pro_until from public.user_profile p where p.user_id = p_target
  ) x;
  select coalesce(p.plan_status = 'pro', false) into was_pro from public.user_profile p where p.user_id = p_target;
  select nullif(trim(u.name), '') into granter from public.user_profile u where u.user_id = auth.uid();

  update public.user_profile
     set plan_status = case when p_pro then 'pro' else 'free' end,
         pro_until   = case when p_pro then p_until else null end,
         -- Granting Pro by hand IS comping; that keeps the paying count honest.
         comped      = case when p_pro then true else comped end,
         -- A NEW grant arms the recipient's celebration (ProGiftCelebration,
         -- delivered live over Realtime). Re-granting someone already on Pro
         -- does not re-arm it, and revoking clears it.
         pro_gift_pending = case when p_pro then (pro_gift_pending or not coalesce(was_pro, false)) else false end,
         pro_gift_by      = case when p_pro and not coalesce(was_pro, false)
                                 then coalesce(granter, 'the ConcordiaTracker team') else pro_gift_by end
   where user_id = p_target;

  perform public.log_admin_action(
    case when p_pro then 'plan.grant' else 'plan.revoke' end,
    p_target, p_reason, before,
    jsonb_build_object('plan_status', case when p_pro then 'pro' else 'free' end,
                       'pro_until', p_until)
  );
end $$;

-- -- Realtime -----------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_profile') then
    alter publication supabase_realtime add table public.user_profile;
  end if;
end $$;
