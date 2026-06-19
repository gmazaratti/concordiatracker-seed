-- ============================================================================
-- Handle uniqueness — stop two users taking the same @handle, plus a helper so
-- onboarding can tell a user live whether a handle is free. Run on PRODUCTION.
--
-- Run STEP 1 first (a SELECT — changes nothing). It MUST return zero rows before
-- the index in STEP 2 can be created. If it returns any rows, two users already
-- share a handle — paste me what it shows and we'll resolve before continuing.
-- ============================================================================

-- ── STEP 1 — pre-check for existing duplicates (must be EMPTY) ───────────────
select lower(handle) as handle, count(*) as users
from public.user_profile
where handle is not null
group by lower(handle)
having count(*) > 1;

-- ── STEP 2 — enforce uniqueness (only run if STEP 1 was empty) ───────────────
-- Case-insensitive, and ignores users who haven't set a handle yet (NULL).
create unique index if not exists user_profile_handle_uidx
  on public.user_profile (lower(handle)) where handle is not null;

-- ── STEP 3 — availability helper for live onboarding feedback ───────────────
-- Per-user RLS hides other users' profiles from the client, so a normal SELECT
-- can't tell whether a handle is taken. This SECURITY DEFINER function can —
-- it returns ONLY a boolean (never anyone else's data). true = free for you.
create or replace function public.handle_available(p_handle text)
returns boolean
language sql security definer set search_path = public as $$
  select not exists (
    select 1 from public.user_profile
    where lower(handle) = lower(trim(p_handle))
      and user_id <> auth.uid()
  );
$$;
grant execute on function public.handle_available(text) to authenticated;
