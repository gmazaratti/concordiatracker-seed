-- ─────────────────────────────────────────────────────────────────────────────
-- Source-attributed landing links (concordiatracker.com/r = Reddit).
--
-- Visiting /r sets a first-party cookie `ct_ref=reddit`. While it is present:
--   site_events.ref        is written on every analytics event
--   user_profile.signup_ref is written once, when the profile row is created
--                            (i.e. at signup), and never overwritten
--
-- Separate from `referred_by_code`, which is a person's vanity referral code:
-- "which campaign sent them" and "which student invited them" are different
-- questions and folding them into one column loses one of the answers.
--
-- Both columns are nullable and constrained to a short slug, so the client
-- cannot write arbitrary text into them. Additive, idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.site_events add column if not exists ref text;
alter table public.user_profile add column if not exists signup_ref text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_events_ref_ck') then
    alter table public.site_events
      add constraint site_events_ref_ck check (ref is null or ref ~ '^[a-z0-9_-]{1,32}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profile_signup_ref_ck') then
    alter table public.user_profile
      add constraint user_profile_signup_ref_ck check (signup_ref is null or signup_ref ~ '^[a-z0-9_-]{1,32}$');
  end if;
end $$;

create index if not exists site_events_ref_idx on public.site_events (ref) where ref is not null;
