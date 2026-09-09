-- ─────────────────────────────────────────────────────────────────────────────
-- How a class is delivered.
--
-- There was nowhere to say "this one is online". `location` is a room string
-- and `time` is a schedule string, so an online section with no fixed meeting
-- had both blank — which read as missing data rather than as a fact about the
-- course, and the schedule builder dropped it entirely because it seeded only
-- courses with a readable meeting time.
--
-- Concordia publishes this on every section (`instructionModeDescription`), so
-- the section autofill can fill it in; the field is editable either way,
-- because a student knows what they registered for and we might not.
--
-- Null means unstated, NOT in-person: a blank we have never asked about should
-- not be reported as an answer.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.courses
  add column if not exists delivery text
  check (delivery is null or delivery in ('in-person', 'online', 'hybrid'));
