-- ─────────────────────────────────────────────────────────────────────────────
-- The rest of the BComm majors.
--
-- `db/majors.sql` added Finance, Accountancy and Marketing with their real
-- course lists. Section 61.21 of the 2026-2027 calendar names TEN majors, and a
-- student in any of the other seven currently cannot pick their programme at
-- all — which is not just a gap in "My programme", it is why the schedule
-- generator says it has nothing outstanding to schedule.
--
--   Accountancy · Business Analytics · Business Technology Management ·
--   Economics · Finance · Human Resource Management · International Business ·
--   Management · Marketing · Supply Chain Operations Management
--
-- Verified against the calendar: BComm is 90 credits — 48 JMSB Core, 24 in the
-- declared major, 6 elective credits outside the School of Business, and 12
-- general electives. That arithmetic matches the `bcomm` groups already in the
-- database exactly, which is the check that the core transcription is right.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO: invent course lists. The seven
-- majors added here carry the 24-credit rule and the calendar page it comes
-- from, and NOTHING is ticked off against them, exactly like every other
-- untranscribed elective rule in this schema. The JMSB Core beneath them is
-- fully transcribed, so a student in any major still sees 48 real credits
-- checked off and the generator still has candidates to work with. Each course
-- list is a separate transcription pass, one department at a time — the same
-- discipline that produced Finance, Accountancy and Marketing.
--
-- Safe to re-run. Requires `db/program_requirements.sql` and `db/majors.sql`
-- first (this file re-applies their structural columns so order cannot bite).
-- ─────────────────────────────────────────────────────────────────────────────

-- Structural bits, repeated so this file stands alone if majors.sql was missed.
alter table public.programs add column if not exists parent_id text references public.programs(id);
alter table public.program_groups add column if not exists pattern jsonb;
alter table public.user_profile add column if not exists major_id text;

-- ── The seven remaining majors ──────────────────────────────────────────────
insert into public.programs
  (id, parent_id, name, faculty, degree, total_credits, calendar_year, source_url)
values
  ('bcomm-business-analytics', 'bcomm', 'Commerce — Business Analytics',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-21-undergraduate-degree-programs.html'),
  ('bcomm-btm', 'bcomm', 'Commerce — Business Technology Management',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-50-department-of-supply-chain-and-business-technology-management.html'),
  ('bcomm-economics', 'bcomm', 'Commerce — Economics',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-60-economics.html'),
  ('bcomm-hrm', 'bcomm', 'Commerce — Human Resource Management',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-90-department-of-management.html'),
  ('bcomm-international-business', 'bcomm', 'Commerce — International Business',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-80-international-business.html'),
  ('bcomm-management', 'bcomm', 'Commerce — Management',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-90-department-of-management.html'),
  ('bcomm-scom', 'bcomm', 'Commerce — Supply Chain Operations Management',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-50-department-of-supply-chain-and-business-technology-management.html')
on conflict (id) do update
  set parent_id      = excluded.parent_id,
      name           = excluded.name,
      faculty        = excluded.faculty,
      degree         = excluded.degree,
      total_credits  = excluded.total_credits,
      calendar_year  = excluded.calendar_year,
      source_url     = excluded.source_url;

-- Positions start at 10, after the degree core's 1-6, so a student sees what
-- everyone does before what their major adds.
delete from public.program_groups
 where program_id in ('bcomm-business-analytics', 'bcomm-btm', 'bcomm-economics',
                      'bcomm-hrm', 'bcomm-international-business', 'bcomm-management',
                      'bcomm-scom');

insert into public.program_groups
  (program_id, position, title, kind, credits, courses, rule, note, pattern)
select
  id,
  10,
  replace(name, 'Commerce — ', '') || ' — major requirements',
  'credits',
  24,
  '[]'::jsonb,
  'Twenty-four credits in the major, from the department''s list in the calendar.',
  'The course list for this major has not been transcribed yet, so nothing here is ticked off — the credits you have passed still show under "not claimed by a group" below. The JMSB Core above is complete.',
  null
from public.programs
where parent_id = 'bcomm'
  and id in ('bcomm-business-analytics', 'bcomm-btm', 'bcomm-economics',
             'bcomm-hrm', 'bcomm-international-business', 'bcomm-management',
             'bcomm-scom');

-- Check: ten majors, each inheriting the bcomm core.
--   select p.id, p.name, count(g.*) as own_groups
--     from public.programs p
--     left join public.program_groups g on g.program_id = p.id
--    where p.parent_id = 'bcomm'
--    group by p.id, p.name order by p.name;
