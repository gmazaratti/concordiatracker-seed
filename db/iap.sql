-- App Store guideline 3.1.1: Pro bought in the iOS app (through RevenueCat).
--
-- Apple purchases live in their OWN columns beside Stripe's, written only by the
-- service role (api/_revenuecat.ts, from RevenueCat's webhook or a sync right
-- after a purchase or restore). plan_status stays the one flag the app reads;
-- each store refuses to drop it while the OTHER still has an active
-- subscription. ct_is_pro also honours iap_expires_at directly, so a missed
-- webhook can never cost a paying student Pro before Apple's own expiry.
-- The guard below is pg_get_functiondef of the live trigger (2026-10-11) with
-- the five new columns added to both halves.

alter table public.user_profile
  add column if not exists iap_expires_at timestamptz,
  add column if not exists iap_product    text,
  add column if not exists iap_status     text,
  add column if not exists iap_env        text,
  add column if not exists iap_will_renew boolean;

CREATE OR REPLACE FUNCTION public.ct_guard_profile_privileged()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
       new.first_seen_at is distinct from old.first_seen_at or
       new.iap_expires_at is distinct from old.iap_expires_at or
       new.iap_product is distinct from old.iap_product or
       new.iap_status is distinct from old.iap_status or
       new.iap_env is distinct from old.iap_env or
       new.iap_will_renew is distinct from old.iap_will_renew then
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
  new.iap_expires_at := null;
  new.iap_product := null;
  new.iap_status := null;
  new.iap_env := null;
  new.iap_will_renew := null;
  return new;
end $function$;

create or replace function public.ct_is_pro(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select exists (
    select 1 from public.user_profile p
    where p.user_id = p_user
      and (p.plan_status = 'pro' or (p.pro_until is not null and p.pro_until > now()) or p.team_pro
           or (p.iap_expires_at is not null and p.iap_expires_at > now()))
  )
$f$;
