-- ─────────────────────────────────────────────────────────────────────────────
-- Engineering, Arts and Science, and Fine Arts.
--
-- Until now the programme list held two entries, so everyone outside Computer
-- Science and Commerce could not pick their programme at all — which is not
-- only a gap in "My programme": the schedule generator reads the saved
-- programme, so it had nothing to build a term out of either.
--
-- WHAT IS TRANSCRIBED AND WHAT IS NOT, stated plainly because the difference
-- matters more than the row count:
--
--   * Every programme here carries its real NAME, FACULTY, DEGREE, CREDIT
--     TOTAL and a link to Concordia's own page for it. Those are facts, checked
--     against the source.
--       - BEng is 120 credits (150 in the Extended Credit Programme) — from
--         Concordia's programme pages, e.g. /undergraduate/software-engineering.
--       - BA / BSc / BFA are 90 credits (120 with ECP), same source.
--   * NONE of them carries a course list yet, so NOTHING is ticked off against
--     them and "My programme" says so in as many words. Transcribing
--     requirements is a per-programme pass done by hand from the calendar —
--     it is what produced the Computer Science and JMSB cores — and inventing
--     the other forty would be the single most expensive mistake this product
--     could make. A student plans a year around a degree audit.
--
-- So this migration buys the thing that was actually broken (you can say what
-- you are in, and everything keyed off that starts working) without buying a
-- confident wrong answer alongside it.
--
-- Concentration sizes deliberately absent for the same reason: Psychology alone
-- is Honours 66 / Specialization 60 / Major 42 credits, and which one you are
-- in is not something we know.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.programs
  (id, name, faculty, degree, total_credits, calendar_year, source_url)
values
  ('eng-aerospace', 'Aerospace Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/aerospace-engineering.html'),
  ('eng-building', 'Building Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/building-engineering.html'),
  ('eng-chemical', 'Chemical Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/chemical-engineering.html'),
  ('eng-civil', 'Civil Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/civil-engineering.html'),
  ('eng-computer', 'Computer Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/computer-engineering.html'),
  ('eng-cybersecurity', 'Cybersecurity Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/cybersecurity-engineering.html'),
  ('eng-electrical', 'Electrical Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/electrical-engineering.html'),
  ('eng-industrial', 'Industrial Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/industrial-engineering.html'),
  ('eng-mechanical', 'Mechanical Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/mechanical-engineering.html'),
  ('eng-software', 'Software Engineering', 'Gina Cody School of Engineering and Computer Science', 'BEng', 120, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/software-engineering.html'),
  ('as-psychology', 'Psychology', 'Faculty of Arts and Science', 'BA, BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/psychology.html'),
  ('as-political-science', 'Political Science', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/political-science.html'),
  ('as-economics', 'Economics', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/economics.html'),
  ('as-english', 'English', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/english.html'),
  ('as-biology', 'Biology', 'Faculty of Arts and Science', 'BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/biology.html'),
  ('as-communication-studies', 'Communication Studies', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/communication-studies.html'),
  ('as-journalism', 'Journalism', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/journalism.html'),
  ('as-sociology', 'Sociology', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/sociology.html'),
  ('as-history', 'History', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/history.html'),
  ('as-exercise-science', 'Exercise Science', 'Faculty of Arts and Science', 'BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/exercise-science.html'),
  ('as-mathematics-and-statistics', 'Mathematics and Statistics', 'Faculty of Arts and Science', 'BA, BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/mathematics-and-statistics.html'),
  ('as-chemistry', 'Chemistry', 'Faculty of Arts and Science', 'BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/chemistry.html'),
  ('as-physics', 'Physics', 'Faculty of Arts and Science', 'BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/physics.html'),
  ('as-philosophy', 'Philosophy', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/philosophy.html'),
  ('as-anthropology', 'Anthropology', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/anthropology.html'),
  ('as-linguistics', 'Linguistics', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/linguistics.html'),
  ('as-geography-planning-and-environment', 'Geography, Planning and Environment', 'Faculty of Arts and Science', 'BA, BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/geography-planning-and-environment.html'),
  ('as-applied-human-sciences', 'Applied Human Sciences', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/applied-human-sciences.html'),
  ('as-religions-and-cultures', 'Religions and Cultures', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/religions-and-cultures.html'),
  ('as-translation', 'Translation', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/translation.html'),
  ('as-urban-studies', 'Urban Studies', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/urban-studies.html'),
  ('as-actuarial-mathematics', 'Actuarial Mathematics', 'Faculty of Arts and Science', 'BA, BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/actuarial-mathematics.html'),
  ('as-education', 'Education', 'Faculty of Arts and Science', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/education.html'),
  ('as-health-and-life-sciences', 'Health and Life Sciences', 'Faculty of Arts and Science', 'BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/health-and-life-sciences.html'),
  ('as-environmental-science', 'Environmental Science', 'Faculty of Arts and Science', 'BSc', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/environmental-science.html'),
  ('fa-design', 'Design', 'Faculty of Fine Arts', 'BFA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/design.html'),
  ('fa-studio-arts', 'Studio Arts', 'Faculty of Fine Arts', 'BFA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/studio-arts.html'),
  ('fa-film-production', 'Film Production', 'Faculty of Fine Arts', 'BFA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/film-production.html'),
  ('fa-computation-arts', 'Computation Arts', 'Faculty of Fine Arts', 'BFA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/computation-arts.html'),
  ('fa-music', 'Music', 'Faculty of Fine Arts', 'BFA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/music.html'),
  ('fa-theatre', 'Theatre', 'Faculty of Fine Arts', 'BFA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/theatre.html'),
  ('fa-art-history', 'Art History', 'Faculty of Fine Arts', 'BA', 90, '2026-2027', 'https://www.concordia.ca/academics/undergraduate/art-history.html')
on conflict (id) do update
  set name          = excluded.name,
      faculty       = excluded.faculty,
      degree        = excluded.degree,
      total_credits = excluded.total_credits,
      calendar_year = excluded.calendar_year,
      source_url    = excluded.source_url;

-- Check: how many programmes now, and how many carry requirements.
--   select p.faculty, count(*) as programmes, count(g.program_id) as with_groups
--     from public.programs p
--     left join (select distinct program_id from public.program_groups) g
--       on g.program_id = p.id
--    group by p.faculty order by p.faculty;
