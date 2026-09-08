-- ─────────────────────────────────────────────────────────────────────────────
-- Two real Fall 2026 outlines, teacher-verified.
--
-- Transcribed from the official course outlines, verbatim on every date and
-- weight. `verified = true` means the source WAS the professor's own document,
-- which is the only thing that badge is ever allowed to mean.
--
-- Note both finals have NO DATE. That is not missing data — FINA 210 says "as
-- per exam schedule" and COMM 309 says the Examinations Office sets it, and
-- inventing a day for either would be exactly the confident wrong answer this
-- product exists to avoid. They import as "date not set" and the student fills
-- it in when the registrar publishes. Requires db/undated_assessments.sql.
--
-- Times: where the outline gives one, it is used. Where it only gives a day
-- ("in class", "submission deadline"), the item lands at 23:59 local, which is
-- a statement about the DAY and not a claim about the hour. Montreal is EDT
-- (UTC-4) until 2 November and EST (UTC-5) after it.
--
-- Run in the Supabase SQL editor (project qagtygymiivnyfwrtmzl). Re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────

delete from public.shared_blueprints
 where verified = true
   and term = 'Fall 2026'
   and (course_code, section) in (('FINA 210', 'B'), ('COMM 309', 'A'));

insert into public.shared_blueprints
  (user_id, course_code, course_name, professor, author, section, term, items, verified)
values
  -- ── FINA 210 B — Introduction to Real Estate — Michel Deslauriers ─────────
  -- Assignments are 10% across three submissions; the outline does not split
  -- them, so 3/3/4 keeps the total exact rather than leaving 0.01 on the floor.
  (null, 'FINA 210', 'Introduction to Real Estate', 'Michel Deslauriers',
   'Course outline', 'B', 'Fall 2026',
   '[
     {"title": "Assignment 1",  "kind": "assignment", "weight": 3,  "due": "2026-09-30T03:59:00+00:00"},
     {"title": "Midterm (Topics 1–5)", "kind": "midterm", "weight": 30, "due": "2026-10-21T03:59:00+00:00"},
     {"title": "Assignment 2",  "kind": "assignment", "weight": 3,  "due": "2026-11-04T04:59:00+00:00"},
     {"title": "Assignment 3",  "kind": "assignment", "weight": 4,  "due": "2026-11-11T04:59:00+00:00"},
     {"title": "Term project (file submission)", "kind": "project", "weight": 15, "due": "2026-11-18T04:59:00+00:00"},
     {"title": "Final exam (comprehensive)", "kind": "final", "weight": 45, "due": null}
   ]'::jsonb,
   true),

  -- ── COMM 309 A — Business Finance — Loretta Hung ─────────────────────────
  -- The 40% floor on the final is in the item title because it changes what a
  -- student should do about it, and a note nobody reads does not.
  (null, 'COMM 309', 'Business Finance', 'Loretta Hung',
   'Course outline', 'A', 'Fall 2026',
   '[
     {"title": "WileyPLUS Assignment I",  "kind": "assignment", "weight": 5,  "due": "2026-10-27T03:59:00+00:00"},
     {"title": "Midterm exam (in class)", "kind": "midterm", "weight": 40, "due": "2026-10-28T03:59:00+00:00"},
     {"title": "WileyPLUS Assignment II", "kind": "assignment", "weight": 5,  "due": "2026-11-24T04:59:00+00:00"},
     {"title": "Final Common Exam — 40% required on this exam to pass", "kind": "final", "weight": 50, "due": null}
   ]'::jsonb,
   true);

-- Check: both should total 100.
--   select course_code, section,
--          (select sum((i->>'weight')::numeric) from jsonb_array_elements(items) i) as total,
--          (select count(*) from jsonb_array_elements(items) i where i->>'due' is null) as undated
--     from public.shared_blueprints
--    where term = 'Fall 2026' and verified;
