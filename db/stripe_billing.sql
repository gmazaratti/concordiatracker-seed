-- ── Stripe billing ───────────────────────────────────────────────────────────
-- Subscription state mirrored from Stripe. The WEBHOOK is the source of truth:
-- the client never writes entitlement, so what a user gets can't drift from what
-- Stripe actually charged.
--
-- Entitlement resolves from TWO independent things (see useSupabaseProfile):
--   • plan_status = 'pro'  — an active/trialing Stripe subscription
--   • pro_until > now()    — a time-limited grant (survey reward, gifted Pro)
-- They're deliberately separate, so cancelling a subscription can never revoke a
-- gift that hasn't expired, and vice versa.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

alter table public.user_profile
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  -- Stripe's own status: trialing | active | past_due | canceled | unpaid | ...
  add column if not exists subscription_status    text,
  -- Which price they're on, so the UI can name the plan without asking Stripe.
  add column if not exists subscription_price_id  text,
  add column if not exists current_period_end     timestamptz,
  add column if not exists cancel_at_period_end   boolean not null default false,
  add column if not exists trial_end              timestamptz;

-- One customer per profile (a duplicate would split someone's billing history).
create unique index if not exists user_profile_stripe_customer_idx
  on public.user_profile (stripe_customer_id)
  where stripe_customer_id is not null;

-- Clients may READ their own billing columns (RLS on user_profile already scopes
-- selects to the owner). They must never WRITE them — the webhook does, using the
-- service-role key, which bypasses RLS. Revoke the columns from normal updates:
revoke update (
  stripe_customer_id, stripe_subscription_id, subscription_status,
  subscription_price_id, current_period_end, cancel_at_period_end, trial_end
) on public.user_profile from authenticated;

-- Idempotency: Stripe retries webhooks, so every processed event id is recorded
-- and re-deliveries are ignored (a double "subscription created" must not grant
-- two periods).
create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- No policies → only the service role (the webhook) can touch it.

-- Admin: see who's actually subscribed, for the console.
create or replace function public.admin_billing_overview()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'subscribers',  (select count(*) from public.user_profile where subscription_status in ('active','trialing')),
    'trialing',     (select count(*) from public.user_profile where subscription_status = 'trialing'),
    'past_due',     (select count(*) from public.user_profile where subscription_status = 'past_due'),
    'cancelling',   (select count(*) from public.user_profile where cancel_at_period_end = true
                       and subscription_status in ('active','trialing'))
  ) into r;
  return r;
end $$;
grant execute on function public.admin_billing_overview() to authenticated;
