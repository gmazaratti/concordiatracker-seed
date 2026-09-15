-- ─────────────────────────────────────────────────────────────────────────────
-- Seven Fall 2026 outlines from eConcordia, hand-verified.
--
-- Source: https://www.econcordia.com/outlines/<slug>.pdf — the university's own
-- published outline for each online section, fetched 15 Sep 2026. `verified`
-- means the source WAS the professor's document, which is the only thing that
-- badge is ever allowed to mean; here the document is published by Concordia
-- itself, and `source_url` makes that checkable rather than merely asserted.
--
-- EVERY WEEKDAY CLAIM IN THESE OUTLINES WAS CHECKED against the 2026 calendar
-- before anything was written: COMM 305's "Sunday, November 1", all four of
-- COMM 225's "Friday" quizzes, its "Oct. 25 (Sunday)" midterm and ENGR 391's
-- two Friday deadlines all land on the weekday the document names. Every
-- scheme below totals exactly 100.
--
-- TIMES are Montreal wall-clock converted to UTC with the zone's real offset,
-- so the 1 November midterm is UTC-5 (DST ended that morning) while October's
-- deadlines are UTC-4. An item the outline leaves as TBA is stored as NULL —
-- inventing a date for a final exam is the exact confident-wrong-answer this
-- product exists to avoid. Requires db/undated_assessments.sql.
--
-- Run in the Supabase SQL editor. Re-runnable: it deletes its own rows first.
-- Requires db/outline_sync.sql for the source_url column.
-- ─────────────────────────────────────────────────────────────────────────────

delete from public.shared_blueprints
 where verified = true
   and term = 'Fall 2026'
   and author = 'Course outline'
   and course_code in
       ('COMM 213', 'COMM 225', 'COMM 226', 'COMM 305', 'COMP 218', 'ENGR 391', 'PHIL 210');

insert into public.shared_blueprints
  (user_id, course_code, course_name, professor, professor_email, office_hours,
   office_location, author, section, term, items, verified, source_url)
values

-- ── COMM 305 EC — Managerial Accounting — Dr Ibrahim Aly ────────────────────
-- Ten WileyPLUS assignments share one 10% band: each is pass/fail at a 60%
-- threshold and the outline scores them as passes × 10. One row each, 1% each,
-- because the DEADLINES are the thing a student needs and three of them land
-- on the same night (27 September).
(null, 'COMM 305', 'Managerial Accounting', 'Ibrahim Aly', 'ibrahim.aly@concordia.ca',
 'By appointment', 'MB 14-221', 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Online assignment 1 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-09-28T03:00:00+00:00"},
   {"title": "Online assignment 2 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-09-28T03:00:00+00:00"},
   {"title": "Online assignment 3 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-09-28T03:00:00+00:00"},
   {"title": "Online assignment 4 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-10-05T03:00:00+00:00"},
   {"title": "Online assignment 5 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-10-19T03:00:00+00:00"},
   {"title": "Online assignment 6 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-10-26T03:00:00+00:00"},
   {"title": "Online assignment 7 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-11-09T04:00:00+00:00"},
   {"title": "Online assignment 8 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-11-16T04:00:00+00:00"},
   {"title": "Online assignment 9 (WileyPLUS)",  "kind": "assignment", "weight": 1, "due": "2026-11-23T04:00:00+00:00"},
   {"title": "Online assignment 10 (WileyPLUS)", "kind": "assignment", "weight": 1, "due": "2026-11-30T04:00:00+00:00"},
   {"title": "Data Analytics Assignment 1 (Power BI)", "kind": "assignment", "weight": 5, "due": "2026-11-09T04:00:00+00:00"},
   {"title": "Data Analytics Assignment 2 (master budget in Excel)", "kind": "assignment", "weight": 5, "due": "2026-11-23T04:00:00+00:00"},
   {"title": "Midterm exam — on campus, on paper, chapters 1-6", "kind": "midterm", "weight": 30, "due": "2026-11-01T19:00:00+00:00"},
   {"title": "Final exam (comprehensive)", "kind": "final", "weight": 50, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/managerial_accounting.pdf'),

-- ── COMM 225 EC — Production and Operations Management ──────────────────────
-- The four online quizzes close at 11:00 pm on their Friday; the midterm is the
-- one in-person sitting, 9:00-11:30 on Sunday 25 October.
(null, 'COMM 225', 'Production and Operations Management', null, null, null, null,
 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Online Quiz 1", "kind": "quiz", "weight": 2.5, "due": "2026-10-03T03:00:00+00:00"},
   {"title": "Online Quiz 2", "kind": "quiz", "weight": 2.5, "due": "2026-10-24T03:00:00+00:00"},
   {"title": "Midterm — in person, 2.5 hours", "kind": "midterm", "weight": 35, "due": "2026-10-25T13:00:00+00:00"},
   {"title": "Online Quiz 3", "kind": "quiz", "weight": 2.5, "due": "2026-11-14T04:00:00+00:00"},
   {"title": "Online Quiz 4", "kind": "quiz", "weight": 2.5, "due": "2026-12-05T04:00:00+00:00"},
   {"title": "Excel assignment (submission date TBA)", "kind": "assignment", "weight": 10, "due": null},
   {"title": "Final examination", "kind": "final", "weight": 45, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/production_operations.pdf'),

-- ── COMM 226 EC — Business Technology Management — Dr Raul Valverde ─────────
-- NOTE: the outline contradicts itself on the final — the evaluation TABLE says
-- 45% and the paragraph under it says 50%. The table is used, because it is the
-- one that totals 100. Flagged here rather than silently picked.
(null, 'COMM 226', 'Business Technology Management', 'Raul Valverde',
 'raul.valverde@concordia.ca', null, null, 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Quizzes (2 online, 2.5% each)", "kind": "quiz", "weight": 5, "due": null},
   {"title": "Interactive Business Cases", "kind": "assignment", "weight": 5, "due": null},
   {"title": "Knowledge Check Quizzes (10)", "kind": "quiz", "weight": 5, "due": null},
   {"title": "Assignment 1 — SAP", "kind": "assignment", "weight": 10, "due": null},
   {"title": "Assignment 2 — Process Mapping & ERD (group)", "kind": "assignment", "weight": 15, "due": null},
   {"title": "Assignment 3 — Business Intelligence (group)", "kind": "assignment", "weight": 15, "due": null},
   {"title": "Final examination (comprehensive)", "kind": "final", "weight": 45, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/information_systems.pdf'),

-- ── COMM 213 EC — Computing and Visualization — Dr Raul Valverde ────────────
(null, 'COMM 213', 'Computing and Visualization', 'Raul Valverde',
 'raul.valverde@concordia.ca', null, null, 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Assignment 1", "kind": "assignment", "weight": 20, "due": null},
   {"title": "Assignment 2", "kind": "assignment", "weight": 20, "due": null},
   {"title": "Quiz", "kind": "quiz", "weight": 20, "due": null},
   {"title": "Final examination", "kind": "final", "weight": 40, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/computing_visualization.pdf'),

-- ── COMP 218 EC — Fundamentals of Programming — Joumana Dargham ─────────────
-- The four assignments are weighted 1/2/3/4 in the outline itself, not split by
-- us. At least three must be submitted.
(null, 'COMP 218', 'Fundamentals of Programming', 'Joumana Dargham',
 'joumana.dargham@concordia.ca', null, null, 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Assignment 1", "kind": "assignment", "weight": 1, "due": null},
   {"title": "Assignment 2", "kind": "assignment", "weight": 2, "due": null},
   {"title": "Assignment 3", "kind": "assignment", "weight": 3, "due": null},
   {"title": "Assignment 4", "kind": "assignment", "weight": 4, "due": null},
   {"title": "Term Test 1 (online)", "kind": "quiz", "weight": 5, "due": null},
   {"title": "Term Test 2 (online)", "kind": "quiz", "weight": 10, "due": null},
   {"title": "Term Test 3 (online)", "kind": "quiz", "weight": 15, "due": null},
   {"title": "Final examination (in person)", "kind": "final", "weight": 60, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/fundamentals_oop.pdf'),

-- ── ENGR 391 — Numerical Methods in Engineering — Dr Rolf Wuthrich ──────────
-- Six assignments share 20%; the outline does not split them, so 3/3/3/3/4/4
-- keeps the total exact. Only the first two deadlines are published in the part
-- of the schedule that parsed cleanly, and the rest are left unset rather than
-- extrapolated from a weekly pattern that may not hold.
-- No section is stated on this outline, so none is recorded.
(null, 'ENGR 391', 'Numerical Methods in Engineering', 'Rolf Wuthrich',
 'rolf.wuthrich@concordia.ca', 'Please check your course announcements', null,
 'Course outline', null, 'Fall 2026',
 '[
   {"title": "Assignment 1", "kind": "assignment", "weight": 3, "due": "2026-09-19T03:59:00+00:00"},
   {"title": "Assignment 2", "kind": "assignment", "weight": 3, "due": "2026-09-26T03:59:00+00:00"},
   {"title": "Assignment 3", "kind": "assignment", "weight": 3, "due": null},
   {"title": "Assignment 4", "kind": "assignment", "weight": 3, "due": null},
   {"title": "Assignment 5", "kind": "assignment", "weight": 4, "due": null},
   {"title": "Assignment 6", "kind": "assignment", "weight": 4, "due": null},
   {"title": "Midterm exam", "kind": "midterm", "weight": 35, "due": null},
   {"title": "Final exam — 50% required on it to pass", "kind": "final", "weight": 45, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/numerical_methods.pdf'),

-- ── PHIL 210 EC — Critical Thinking — A. Alexander Antonopoulos ─────────────
-- You choose three of the ten reflection activities, so their dates depend on
-- which you pick and are deliberately unset.
(null, 'PHIL 210', 'Critical Thinking', 'A. Alexander Antonopoulos',
 'phil210ec@concordia.ca', null, null, 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Reflection activity 1 (choose any 3 of 10)", "kind": "assignment", "weight": 5, "due": null},
   {"title": "Reflection activity 2 (choose any 3 of 10)", "kind": "assignment", "weight": 5, "due": null},
   {"title": "Reflection activity 3 (choose any 3 of 10)", "kind": "assignment", "weight": 5, "due": null},
   {"title": "Quiz 1", "kind": "quiz", "weight": 15, "due": null},
   {"title": "Quiz 2", "kind": "quiz", "weight": 15, "due": null},
   {"title": "Quiz 3", "kind": "quiz", "weight": 15, "due": null},
   {"title": "Final examination", "kind": "final", "weight": 40, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/critical_thinking.pdf');

-- Check: every one of these must total exactly 100.
--   select course_code, section,
--          (select sum((i->>'weight')::numeric) from jsonb_array_elements(items) i) as total,
--          jsonb_array_length(items) as items
--     from public.shared_blueprints
--    where term = 'Fall 2026' and author = 'Course outline'
--    order by course_code;
