-- ============================================================================
-- Story duration: 24, 48 or 72 hours, enforced where it cannot be skipped.
--
-- The composer asks after you tap send: 24h (default) / 48h / 72h. `expires_at` is
-- a column the INSERT policy lets the client write, so without this a club
-- could post a story that lasts a year straight through PostgREST and the
-- picker's maximum would be decoration.
--
-- EXACTLY THE THREE OFFERED LENGTHS, each with ten minutes of slack: the
-- client stamps expires_at from its own clock and created_at is the
-- server's, so the two never differ by exactly 24 hours. A 30-hour story is
-- refused just like a year-long one.
--
-- LATER, NOT NOW: durations over 24h (and boosting a story to the front of
-- the row) are meant to become enterprise-only. That is a gate on WHO may
-- pick them, which this constraint does not decide — it only bounds what
-- anybody can.
--
-- Re-runnable. Added NOT VALID so a story already posted at 12h (allowed
-- by the first version of this file, for a few hours) is not a reason for
-- the migration to fail; every NEW row is checked. It expires by itself.
-- ============================================================================

alter table public.org_stories drop constraint if exists org_stories_duration_ck;
alter table public.org_stories add constraint org_stories_duration_ck
  check (
    abs(extract(epoch from (expires_at - created_at)) - 86400) <= 600
    or abs(extract(epoch from (expires_at - created_at)) - 172800) <= 600
    or abs(extract(epoch from (expires_at - created_at)) - 259200) <= 600
  ) not valid;
