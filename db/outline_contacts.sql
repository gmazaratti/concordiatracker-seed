-- ─────────────────────────────────────────────────────────────────────────────
-- Outlines carry the professor's contact details, and importing fills them in.
--
-- A course outline states who teaches it, their email, their office and their
-- office hours on page one — and none of that was being kept. `professor` held
-- a name and nothing else, so a student imported six dated assessments and then
-- typed the instructor's email in by hand off the PDF they had just uploaded.
--
-- These are the four fields worth carrying, and no more:
--   professor_email  the address on the outline
--   office_hours     verbatim, including "By appointment" — which IS the answer
--   office_location  where the professor sits
--   classroom        where the class meets, because Concordia's section feed
--                    frequently publishes no room at all
--
-- Deliberately NOT meeting times: the section feed gives "Tue 08:45–11:30" and
-- an outline gives "Tuesday 8:45 AM", and the feed's version is both more
-- precise and already wired into the week grid.
--
-- On import these only ever fill a BLANK field. An outline must never overwrite
-- something a student typed: they know their own class and we are reading a PDF.
--
-- Values below are transcribed from the outlines themselves, which is the only
-- thing the teacher-verified badge is ever allowed to mean.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.shared_blueprints
  add column if not exists professor_email text,
  add column if not exists office_hours    text,
  add column if not exists office_location text,
  add column if not exists classroom       text;

update public.shared_blueprints
   set professor       = 'Michel Deslauriers',
       professor_email = 'michel.deslauriers@concordia.ca',
       office_hours    = 'By appointment',
       office_location = 'MB 12.234',
       classroom       = 'MB S1.235'
 where course_code = 'FINA 210'
   and section = 'B'
   and term = 'Fall 2026';

update public.shared_blueprints
   set professor       = 'Loretta Hung',
       professor_email = 'loretta.hung@concordia.ca'
 where course_code = 'COMM 309'
   and section = 'A'
   and term = 'Fall 2026';

-- Check:
--   select course_code, section, professor, professor_email, office_hours,
--          office_location, classroom
--     from public.shared_blueprints
--    where term = 'Fall 2026' and verified;
