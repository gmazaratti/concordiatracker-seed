-- ============================================================================
-- Student onboarding — public handle + a completion flag on user_profile. DEV.
-- name + program (major) columns already exist; this adds the two new fields the
-- onboarding flow needs.
-- ============================================================================

alter table public.user_profile add column if not exists handle text;
alter table public.user_profile add column if not exists onboarding_completed boolean not null default false;

-- Handle uniqueness is DEFERRED per "validate later / stub now" — the onboarding
-- does a basic format check only. When you want it enforced platform-wide, add:
--   create unique index user_profile_handle_uidx
--     on public.user_profile (lower(handle)) where handle is not null;
