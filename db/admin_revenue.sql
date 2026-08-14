-- ── Estimated revenue for the admin dashboard ────────────────────────────────
-- Computed from the ACTUAL amount and billing interval Stripe reports, mirrored
-- onto user_profile by the webhook — not from prices hardcoded here. If you
-- change a price in Stripe, this follows automatically.
--
-- Deliberately labelled ESTIMATED: Stripe remains the source of truth for money,
-- and these figures are GROSS (before Stripe's ~2.9% + $0.30 per charge).
-- Trials are counted separately — a trial isn't revenue until the card is
-- actually charged.
--
-- RUN AFTER db/stripe_billing.sql, and deploy the matching webhook change so new
-- events populate the two columns. Safe to re-run.

alter table public.user_profile
  add column if not exists subscription_amount_cents    int,
  -- Billing period expressed in months (semester pass = 4, monthly = 1).
  add column if not exists subscription_interval_months numeric;

revoke update (subscription_amount_cents, subscription_interval_months)
  on public.user_profile from authenticated;

create or replace function public.admin_revenue()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  with subs as (
    select
      subscription_status                                   as status,
      coalesce(subscription_amount_cents, 0)                as period_cents,
      -- Normalise every plan to a monthly figure so they can be summed honestly.
      coalesce(subscription_amount_cents, 0)
        / nullif(coalesce(subscription_interval_months, 1), 0) as monthly_cents
    from public.user_profile
    where subscription_status in ('active', 'trialing')
  )
  select jsonb_build_object(
    'paying',     (select count(*) from subs where status = 'active'),
    'trialing',   (select count(*) from subs where status = 'trialing'),
    'past_due',   (select count(*) from public.user_profile where subscription_status = 'past_due'),
    'cancelling', (select count(*) from public.user_profile
                     where cancel_at_period_end and subscription_status in ('active','trialing')),
    -- Comped access that generates no revenue (gifted Pro / survey rewards).
    'comped',     (select count(*) from public.user_profile
                     where pro_until is not null and pro_until > now()
                       and coalesce(subscription_status,'') not in ('active','trialing')),

    'mrr_cents',       (select coalesce(round(sum(monthly_cents)), 0) from subs where status = 'active'),
    'arr_cents',       (select coalesce(round(sum(monthly_cents) * 12), 0) from subs where status = 'active'),
    -- Upper bound on what trials would add if every one converted.
    'trial_mrr_cents', (select coalesce(round(sum(monthly_cents)), 0) from subs where status = 'trialing'),
    -- What the current period is worth across active subscriptions.
    'period_cents',    (select coalesce(sum(period_cents), 0) from subs where status = 'active'),
    -- How many active rows predate the webhook change (their value is unknown,
    -- so the totals above understate reality until their next Stripe event).
    'missing_amounts', (select count(*) from public.user_profile
                          where subscription_status = 'active' and subscription_amount_cents is null),
    'currency', 'cad'
  ) into r;
  return r;
end $$;
grant execute on function public.admin_revenue() to authenticated;
