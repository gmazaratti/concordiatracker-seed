-- ─────────────────────────────────────────────────────────────────────────────
-- Twelve more Fall 2026 eConcordia outlines, hand-verified. Batch two.
--
-- Same rules as db/outlines_econcordia_fall2026.sql: read from the university's
-- own published PDF, `source_url` on every row so the badge is checkable, every
-- scheme totals exactly 100, and a date the outline does not give is NULL
-- rather than invented. Montreal wall-clock converted with the zone's real
-- offset (UTC-4 before 1 November, UTC-5 after).
--
-- WHERE AN OUTLINE COVERS SEVERAL SECTIONS (COMM 216 is EC1/EC2/EC3, COMM 219
-- is EC1/EC2, COMM 316 is EC1/EC2) the section is left NULL. Writing one of
-- them would make the app warn every other section's students that these dates
-- are "not yours", which is the opposite of true.
--
-- NOT INCLUDED, deliberately: PSYC 205's evaluation table does not survive text
-- extraction cleanly enough to tell whether its two tests are 20% each or 20%
-- together, and PHIL 235 / PSYC 333 / AHSC 322 produce no readable header at
-- all. Guessing any of them would put a wrong weight behind a verified badge.
-- They are left to the sync, which drops anything that does not total 100.
--
-- Run after db/outline_sync.sql. Re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────

delete from public.shared_blueprints
 where verified = true
   and term = 'Fall 2026'
   and author = 'Course outline'
   and course_code in
       ('COMM 214', 'COMM 216', 'COMM 219', 'COMM 316', 'ENGL 251', 'FINA 200',
        'GDBA 595', 'PHIL 266', 'PHYS 204', 'PHYS 205', 'PHYS 284', 'PSYC 305',
        'SOCI 262');

insert into public.shared_blueprints
  (user_id, course_code, course_name, professor, professor_email, author,
   section, term, items, verified, source_url)
values

-- ── COMM 214 EC — Business Analytics — Chaher Alzaman ──────────────────────
-- Quizzes and study activities are both "best 3 of 5", so five rows each would
-- promise five graded items when only three count. One row per band, named for
-- what it is.
(null, 'COMM 214', 'Business Analytics', 'Chaher Alzaman', 'comm214_ec@concordia.ca',
 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Quizzes — best 3 of 5", "kind": "quiz", "weight": 8, "due": null},
   {"title": "Study activities (CONNECT) — best 3 of 5", "kind": "assignment", "weight": 8, "due": null},
   {"title": "Midterm examination (chapters 1-4, 6-7)", "kind": "midterm", "weight": 22, "due": null},
   {"title": "Data Analysis Project (team)", "kind": "project", "weight": 7, "due": null},
   {"title": "Final examination — 50% required on it to pass", "kind": "final", "weight": 55, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/business_analytics.pdf'),

-- ── COMM 216 — Ethics, Business Sustainability and Social Responsibility ───
-- Raymond Paquin. One outline for EC1, EC2 and EC3.
(null, 'COMM 216', 'Ethics, Business Sustainability and Social Responsibility',
 'Raymond Paquin', 'comm216.paquin@concordia.ca', 'Course outline', null, 'Fall 2026',
 '[
   {"title": "SmartBook interactive chapter readings (5 x 4%)", "kind": "reading", "weight": 20, "due": null},
   {"title": "Chapter quizzes (5 x 4%)", "kind": "quiz", "weight": 20, "due": null},
   {"title": "Assignment 1", "kind": "assignment", "weight": 10, "due": null},
   {"title": "Assignment 2", "kind": "assignment", "weight": 10, "due": null},
   {"title": "Final exam (in person) — 50% required on it to pass", "kind": "final", "weight": 40, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/business_sustainability.pdf'),

-- ── COMM 219 — Innovation Management — Sumin Song (EC1, EC2) ───────────────
(null, 'COMM 219', 'Innovation Management', 'Sumin Song', 'sumin.song@concordia.ca',
 'Course outline', null, 'Fall 2026',
 '[
   {"title": "Knowledge checks", "kind": "quiz", "weight": 10, "due": null},
   {"title": "Lesson activities", "kind": "assignment", "weight": 10, "due": null},
   {"title": "Term project (report, presentation video, fund allocation)", "kind": "project", "weight": 30, "due": null},
   {"title": "Final exam (closed book, in person)", "kind": "final", "weight": 50, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/innovation_management.pdf'),

-- ── COMM 316 — Business Law and Ethics (EC1, EC2) ──────────────────────────
-- Two items only. An 80% final is worth seeing before you plan the term.
(null, 'COMM 316', 'Business Law and Ethics', null, 'comm316ec@concordia.ca',
 'Course outline', null, 'Fall 2026',
 '[
   {"title": "Online class test (lessons 1-2, 30 MCQ, 45 minutes)", "kind": "quiz", "weight": 20, "due": null},
   {"title": "Final exam (in person)", "kind": "final", "weight": 80, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/business_law.pdf'),

-- ── FINA 200 / GDBA 595 — Personal Finance ─────────────────────────────────
-- Cross-listed: one outline, two codes, so both sets of students can find it.
-- Every deadline is 11:59 PM on the stated day.
(null, 'FINA 200', 'Personal Finance', null, 'fina200ec@concordia.ca',
 'Course outline', null, 'Fall 2026',
 '[
   {"title": "Quiz 1 (chapters 1-6)", "kind": "quiz", "weight": 10, "due": "2026-10-22T03:59:00+00:00"},
   {"title": "Case 1 (chapters 1-7)", "kind": "assignment", "weight": 15, "due": "2026-11-04T04:59:00+00:00"},
   {"title": "Quiz 2 (chapters 7-10, 13)", "kind": "quiz", "weight": 10, "due": "2026-11-19T04:59:00+00:00"},
   {"title": "Case 2 (chapters 8-10, 13-16)", "kind": "assignment", "weight": 15, "due": "2026-12-02T04:59:00+00:00"},
   {"title": "Final exam (in person, cumulative)", "kind": "final", "weight": 50, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/personal_finance.pdf'),

(null, 'GDBA 595', 'Personal Finance', null, 'fina200ec@concordia.ca',
 'Course outline', null, 'Fall 2026',
 '[
   {"title": "Quiz 1 (chapters 1-6)", "kind": "quiz", "weight": 10, "due": "2026-10-22T03:59:00+00:00"},
   {"title": "Case 1 (chapters 1-7)", "kind": "assignment", "weight": 15, "due": "2026-11-04T04:59:00+00:00"},
   {"title": "Quiz 2 (chapters 7-10, 13)", "kind": "quiz", "weight": 10, "due": "2026-11-19T04:59:00+00:00"},
   {"title": "Case 2 (chapters 8-10, 13-16)", "kind": "assignment", "weight": 15, "due": "2026-12-02T04:59:00+00:00"},
   {"title": "Final exam (in person, cumulative)", "kind": "final", "weight": 50, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/personal_finance.pdf'),

-- ── PHYS 204 EC1 — Mechanics — Laszlo Kalman ───────────────────────────────
-- FLEXIBLE GRADING. The outline offers Option A (midterm 20 / final 50) and
-- Option B (midterm 0 / final 70) for eligible students. Option A is recorded
-- because it is the default and the one with a midterm to plan around; the
-- alternative is named in the final's title rather than hidden in a note.
(null, 'PHYS 204', 'Mechanics', 'Laszlo Kalman', 'laszlo.kalman@concordia.ca',
 'Course outline', 'EC1', 'Fall 2026',
 '[
   {"title": "Weekly homework quizzes (best 10 of 12)", "kind": "quiz", "weight": 10, "due": null},
   {"title": "Assignments (best 5 of 6, 4% each)", "kind": "assignment", "weight": 20, "due": null},
   {"title": "Midterm exam", "kind": "midterm", "weight": 20, "due": null},
   {"title": "Final exam — or 70% if you take the no-midterm option", "kind": "final", "weight": 50, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/mechanics.pdf'),

-- ── PHYS 205 EC1 — Electricity and Magnetism — Valter Zazubovits ───────────
(null, 'PHYS 205', 'Electricity and Magnetism', 'Valter Zazubovits',
 'valter.zazubovits@concordia.ca', 'Course outline', 'EC1', 'Fall 2026',
 '[
   {"title": "Weekly quizzes (best 10 of 12)", "kind": "quiz", "weight": 10, "due": null},
   {"title": "Assignments", "kind": "assignment", "weight": 15, "due": null},
   {"title": "Midterm exam", "kind": "midterm", "weight": 25, "due": null},
   {"title": "Final exam — or 75% if you take the no-midterm option", "kind": "final", "weight": 50, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/electricity_magnetism.pdf'),

-- ── PHYS 284 EC1 — Introduction to Astronomy ───────────────────────────────
(null, 'PHYS 284', 'Introduction to Astronomy', null, 'phys284ec.mld@concordia.ca',
 'Course outline', 'EC1', 'Fall 2026',
 '[
   {"title": "Graded quiz 1", "kind": "quiz", "weight": 15, "due": null},
   {"title": "Graded quiz 2", "kind": "quiz", "weight": 15, "due": null},
   {"title": "Graded quiz 3", "kind": "quiz", "weight": 15, "due": null},
   {"title": "Discussion activities (4)", "kind": "assignment", "weight": 15, "due": null},
   {"title": "Final exam (closed book)", "kind": "final", "weight": 40, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/introduction_astronomy.pdf'),

-- ── PSYC 305 EC — History and Systems — Krystle-Lee Turgeon ────────────────
-- The five quiz dates are printed in the outline; 11:59 PM is the course's own
-- deadline convention where no time is stated.
(null, 'PSYC 305', 'History and Systems of Psychology', 'Krystle-Lee Turgeon',
 'krystlelee.turgeon@concordia.ca', 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Participation (throughout the term)", "kind": "assignment", "weight": 25, "due": null},
   {"title": "Quiz 1", "kind": "quiz", "weight": 6, "due": "2026-09-22T03:59:00+00:00"},
   {"title": "Quiz 2", "kind": "quiz", "weight": 6, "due": "2026-10-06T03:59:00+00:00"},
   {"title": "Quiz 3", "kind": "quiz", "weight": 6, "due": "2026-10-27T03:59:00+00:00"},
   {"title": "Quiz 4", "kind": "quiz", "weight": 6, "due": "2026-11-10T04:59:00+00:00"},
   {"title": "Quiz 5", "kind": "quiz", "weight": 6, "due": "2026-11-24T04:59:00+00:00"},
   {"title": "Final exam (in person)", "kind": "final", "weight": 45, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/history_systems.pdf'),

-- ── PHIL 266 EC — Introduction to Philosophy of Religion ───────────────────
-- Quizzes one and two are dated in the outline and both fall on the Friday it
-- names; the third is not dated.
(null, 'PHIL 266', 'Introduction to Philosophy of Religion', null, null,
 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Quiz 1 (lessons 2-4)", "kind": "quiz", "weight": 20, "due": "2026-10-03T03:59:00+00:00"},
   {"title": "Quiz 2 (lessons 5-7)", "kind": "quiz", "weight": 20, "due": "2026-10-31T03:59:00+00:00"},
   {"title": "Quiz 3", "kind": "quiz", "weight": 20, "due": null},
   {"title": "Final exam (in person)", "kind": "final", "weight": 40, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/philosophy_religion.pdf'),

-- ── SOCI 262 EC — Social Deviance — Amy Swiffen ────────────────────────────
-- The group film activity is 10% group + 5% self-and-peer assessment; both are
-- listed because they are submitted separately.
(null, 'SOCI 262', 'Social Deviance', 'Amy Swiffen', 'amy.swiffen@concordia.ca',
 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Quizzes (3 x 10%)", "kind": "quiz", "weight": 30, "due": null},
   {"title": "Knowledge check questions (5 x 3%)", "kind": "assignment", "weight": 15, "due": null},
   {"title": "Group film activity (group submission)", "kind": "project", "weight": 10, "due": null},
   {"title": "Self-assessment and peer evaluation", "kind": "assignment", "weight": 5, "due": null},
   {"title": "Final exam (in person)", "kind": "final", "weight": 40, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/social_deviance.pdf'),

-- ── ENGL 251 EC — The Graphic Novel — D. Wershler ──────────────────────────
(null, 'ENGL 251', 'The Graphic Novel', 'D. Wershler', 'd.wershler@concordia.ca',
 'Course outline', 'EC', 'Fall 2026',
 '[
   {"title": "Discussion forum participation", "kind": "assignment", "weight": 10, "due": null},
   {"title": "Blog post 1", "kind": "assignment", "weight": 10, "due": null},
   {"title": "Blog post 2", "kind": "assignment", "weight": 10, "due": null},
   {"title": "Graphic novel review and recommendation", "kind": "assignment", "weight": 20, "due": null},
   {"title": "Graphic novel page annotation (week of lesson 8)", "kind": "assignment", "weight": 20, "due": null},
   {"title": "Final paper", "kind": "project", "weight": 30, "due": null}
 ]'::jsonb,
 true, 'https://www.econcordia.com/outlines/graphic_novel.pdf');

-- Check: every row must total exactly 100.
--   select course_code, section,
--          (select sum((i->>'weight')::numeric) from jsonb_array_elements(items) i) as total
--     from public.shared_blueprints
--    where term = 'Fall 2026' and author = 'Course outline'
--    order by course_code;
