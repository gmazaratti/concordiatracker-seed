-- ── Clearing test-mode Stripe state before the first live charge ─────────────
--
-- Stripe objects are mode-scoped: a customer created with sk_test_ does not
-- exist under sk_live_. Any stripe_customer_id left in user_profile therefore
-- points at something the live API will reject with "No such customer", and
-- checkout fails for exactly the people who tried the product first.
--
-- Clearing the id is safe: ensureCustomer() creates a fresh live customer on
-- the next checkout and writes the new id back. Nothing real is lost, because
-- nothing real was ever charged in test mode.
--
-- RUN THIS ONCE, AFTER the live keys are in Vercel and BEFORE announcing
-- payments. Re-running is harmless.

-- 1. Look before you delete — this is what will be reset.
select
  user_id,
  plan_status,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id
from public.user_profile
where stripe_customer_id is not null
   or stripe_subscription_id is not null
order by plan_status;

-- 2. Reset every Stripe-owned column to its pre-billing state.
--    Only columns the webhook owns are touched; profile data is untouched.
update public.user_profile
set
  stripe_customer_id           = null,
  stripe_subscription_id       = null,
  subscription_status          = null,
  subscription_price_id        = null,
  subscription_amount_cents    = null,
  subscription_interval_months = null,
  current_period_end           = null,
  cancel_at_period_end         = false,
  trial_end                    = null,
  -- Anyone whose Pro came from a TEST subscription loses it, which is correct:
  -- they never paid. Comp'd accounts are handled separately below.
  plan_status                  = 'free'
where stripe_customer_id is not null
   or stripe_subscription_id is not null;

-- 3. Test-mode webhook events, so a replayed id can't collide with a live one.
delete from public.stripe_events;

-- 4. OPTIONAL — restore any accounts you granted Pro by hand (the admin
--    "grant Pro" flow), which step 2 just reset along with the test ones.
--    Fill in the handles you actually comp'd; leave commented out otherwise.
-- update public.user_profile
--    set plan_status = 'pro'
--  where handle in ('alex');

-- 5. Verify: nothing Stripe-shaped should remain.
select count(*) as leftover_stripe_rows
from public.user_profile
where stripe_customer_id is not null
   or stripe_subscription_id is not null;
