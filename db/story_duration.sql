-- ============================================================================
-- Story duration: 12 hours to 3 days, enforced where it cannot be skipped.
--
-- The composer offers 12h / 24h (default) / 2 days / 3 days. `expires_at` is
-- a column the INSERT policy lets the client write, so without this a club
-- could post a story that lasts a year straight through PostgREST and the
-- picker's maximum would be decoration.
--
-- A RANGE, not the four exact values: the client stamps expires_at from its
-- own clock and created_at is the server's, so the two never differ by
-- exactly 12 hours. A few minutes of slack either side absorbs clock skew
-- without letting anything meaningfully longer through.
--
-- LATER, NOT NOW: durations over 24h (and boosting a story to the front of
-- the row) are meant to become enterprise-only. That is a gate on WHO may
-- pick them, which this constraint does not decide — it only bounds what
-- anybody can.
--
-- Additive and re-runnable. Every existing row is created_at + 24h, inside
-- the range, so validation cannot fail.
-- ============================================================================

alter table public.org_stories drop constraint if exists org_stories_duration_ck;
alter table public.org_stories add constraint org_stories_duration_ck
  check (
    expires_at >= created_at + interval '11 hours 50 minutes'
    and expires_at <= created_at + interval '72 hours 10 minutes'
  );
