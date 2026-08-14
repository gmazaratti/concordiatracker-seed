-- ── Trial-ending reminder ────────────────────────────────────────────────────
-- Stripe's own "trial ending" email fires 7 days out, which is useless for any
-- trial shorter than a week and cuts it fine even at exactly 7. A student who
-- gets charged with no warning disputes the charge, and a dispute costs the
-- $15 sale plus a dispute fee — so one surprise charge wipes out two sales.
-- This is the cheap insurance: our own push, 24h before the card is charged.
--
-- RUN AFTER db/stripe.sql (needs user_profile.trial_end + subscription_status).
-- Safe to re-run.

-- Which trial_end we already warned about. Storing the VALUE rather than a
-- boolean means a second trial later (cancel → resubscribe) re-arms the
-- reminder automatically — there's no flag to remember to reset.
alter table public.user_profile
  add column if not exists trial_reminder_for timestamptz;

create index if not exists user_profile_trial_end_idx
  on public.user_profile (trial_end)
  where trial_end is not null;

/**
 * Claim the trials ending in the next 24h and return them.
 *
 * The UPDATE ... RETURNING is deliberate: stamping and reading in ONE statement
 * makes the claim atomic, so two overlapping cron ticks can't both send the same
 * reminder. Same pattern as admin_activity_digests().
 *
 * Excludes anyone who already cancelled — they won't be charged, so warning them
 * about a charge would be both wrong and alarming.
 */
create or replace function public.trial_ending_soon()
returns table (user_id uuid, trial_end timestamptz, amount_cents int)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.user_profile p
     set trial_reminder_for = p.trial_end
   where p.subscription_status = 'trialing'
     and p.trial_end is not null
     and p.trial_end > now()
     and p.trial_end <= now() + interval '24 hours'
     and coalesce(p.cancel_at_period_end, false) = false
     and (p.trial_reminder_for is null or p.trial_reminder_for <> p.trial_end)
  returning p.user_id, p.trial_end, p.subscription_amount_cents;
end $$;

-- Service role only (the cron calls it). Never exposed to anon/authenticated:
-- it returns other people's billing state.
revoke all on function public.trial_ending_soon() from public, anon, authenticated;
