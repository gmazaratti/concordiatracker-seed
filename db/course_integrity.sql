-- ============================================================================
-- Grades that are grades, and one course per course.
--
-- Found by QA as a regular user on the live site:
--   * Typing "abc", "150" or "-10" into a grade field saved it. The client now
--     refuses all three (src/lib/grade.ts → readGradeInput), but a client check
--     is only a suggestion: the API, a script or the next form written in a
--     hurry can still send one. These CHECKs make the database refuse a grade
--     that cannot exist.
--   * The same course added from onboarding, the finished-course form and a
--     semester import made THREE records — one class read as three courses and
--     ten credits. The app now looks before it inserts (src/lib/course-match.ts),
--     and this index makes a second record of one course in one term impossible
--     however it is attempted.
--
-- Measured before writing: 0 assignments with a score outside 0-100, 0 raw
-- scores outside 0-total, 0 half-filled raw scores, 0 final grades outside
-- 0-100, and 0 duplicate (student, code, term) groups among courses that have a
-- code. So every constraint below validates against the data as it is.
--
-- Untitled courses (no code yet) are deliberately NOT covered by the index:
-- there is nothing to compare, and a student may be midway through creating one.
-- Re-runnable.
-- ============================================================================

-- ── Assessment grades ───────────────────────────────────────────────────────
alter table public.assignments drop constraint if exists assignments_score_range_ck;
alter table public.assignments
  add constraint assignments_score_range_ck check (score is null or (score >= 0 and score <= 100));

alter table public.assignments drop constraint if exists assignments_raw_pair_ck;
alter table public.assignments
  add constraint assignments_raw_pair_ck check ((raw_score is null) = (raw_total is null));

alter table public.assignments drop constraint if exists assignments_raw_range_ck;
alter table public.assignments
  add constraint assignments_raw_range_ck check (
    raw_total is null or (raw_total > 0 and raw_score >= 0 and raw_score <= raw_total)
  );

-- ── Finished-course grades ──────────────────────────────────────────────────
alter table public.courses drop constraint if exists courses_final_percent_ck;
alter table public.courses
  add constraint courses_final_percent_ck check (
    final_percent is null or (final_percent >= 0 and final_percent <= 100)
  );

-- ── One record per course per term ─────────────────────────────────────────
-- The same normalisers the app's catalogue joins and term backfill use, so
-- "COMP 248" / "comp248" and "Fall 2026" / "FALL 2026" are one key here too.
create unique index if not exists courses_one_per_term_uidx
  on public.courses (user_id, public.ct_norm_code(code), public.ct_normalize_term(coalesce(term, '')))
  where public.ct_norm_code(code) <> '';
