-- ─────────────────────────────────────────────────────────────────────────────
-- BComm majors: Finance, Accountancy, Marketing.
--
-- Two structural additions, both small:
--
--   1. programs.parent_id — a major is a programme that INHERITS a degree's
--      groups. BComm's 48-credit core is written once and Finance, Accountancy
--      and Marketing all point at it. Without this the core would be copied
--      three times and drift the first time the calendar changed.
--
--   2. program_groups.pattern — a machine-readable form of an elective rule.
--      The degree-level electives ("14 credits of Computer Science courses at
--      the 300 level or above, subject to exclusions") stay prose, because the
--      exclusion lists defeat any honest parse. But every one of these three
--      majors states its electives as a plain subject-and-level rule:
--
--        Finance      "18 credits of additional 400-level courses offered by
--                      the Department"
--        Accountancy  "9 credits chosen from additional courses offered by the
--                      Department"
--        Marketing    "12 credits of additional 400-level MARK courses"
--
--      Those ARE checkable — subject FINA, catalogue >= 400 — so they get
--      counted, and the recommender can suggest against them. A group with no
--      pattern still counts nothing and shows the calendar's wording, exactly
--      as before.
--
-- Sources verified against the 2026-2027 calendar, section 61.
-- Run this in the Supabase SQL editor (project qagtygymiivnyfwrtmzl).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.programs add column if not exists parent_id text references public.programs(id);

-- {"subject":"FINA","min_catalog":400}. Null means "prose we will not interpret".
alter table public.program_groups add column if not exists pattern jsonb;

-- Which major, on top of which degree. Separate from program_id because they
-- answer different questions: the degree decides the core, the major decides
-- the other 24 credits.
alter table public.user_profile add column if not exists major_id text;

-- ── The three majors ────────────────────────────────────────────────────────
delete from public.program_groups
 where program_id in ('bcomm-finance', 'bcomm-accountancy', 'bcomm-marketing');
delete from public.programs
 where id in ('bcomm-finance', 'bcomm-accountancy', 'bcomm-marketing');

insert into public.programs
  (id, parent_id, name, faculty, degree, total_credits, calendar_year, source_url)
values
  ('bcomm-finance', 'bcomm', 'Commerce — Finance',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-70-department-of-finance/bcomm-major-in-finance.html'),
  ('bcomm-accountancy', 'bcomm', 'Commerce — Accountancy',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-40-department-of-accountancy/bcomm-major-in-accountancy.html'),
  ('bcomm-marketing', 'bcomm', 'Commerce — Marketing',
   'John Molson School of Business', 'BComm', 90, '2026-2027',
   'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-100-department-of-marketing/bcomm-major-in-marketing.html')
on conflict (id) do update
  set parent_id = excluded.parent_id,
      name = excluded.name,
      total_credits = excluded.total_credits,
      calendar_year = excluded.calendar_year,
      source_url = excluded.source_url;

-- Positions start at 10 so a major's groups always sort AFTER the degree core,
-- which occupies 1-6. That ordering is what a student expects: the things
-- everyone does, then the things their major adds.

-- Finance: 24 credits = 6 required + 18 at the 400 level.
insert into public.program_groups
  (program_id, position, title, kind, credits, courses, rule, pattern) values
  ('bcomm-finance', 10, 'Finance — required', 'all', 6,
   '[{"code":"FINA 385","title":"Theory of Finance I","credits":3},
     {"code":"FINA 395","title":"Theory of Finance II","credits":3}]'::jsonb,
   null, null),
  ('bcomm-finance', 11, 'Finance — 400-level electives', 'credits', 18,
   '[]'::jsonb,
   '18 credits of additional 400-level courses offered by the Department.',
   '{"subject":"FINA","min_catalog":400}'::jsonb);

-- Accountancy: 24 credits = 15 required + 9 from the department, any level.
insert into public.program_groups
  (program_id, position, title, kind, credits, courses, rule, pattern) values
  ('bcomm-accountancy', 10, 'Accountancy — required', 'all', 15,
   '[{"code":"ACCO 310","title":"Financial Reporting I","credits":3},
     {"code":"ACCO 320","title":"Financial Reporting II","credits":3},
     {"code":"ACCO 330","title":"Cost and Management Accounting","credits":3},
     {"code":"ACCO 340","title":"Income Taxation in Canada","credits":3},
     {"code":"ACCO 400","title":"Accounting in Society","credits":3}]'::jsonb,
   null, null),
  ('bcomm-accountancy', 11, 'Accountancy — electives', 'credits', 9,
   '[]'::jsonb,
   '9 credits chosen from additional courses offered by the Department.',
   '{"subject":"ACCO"}'::jsonb);

-- Marketing: 24 credits = 12 required + 12 at the 400 level.
insert into public.program_groups
  (program_id, position, title, kind, credits, courses, rule, pattern) values
  ('bcomm-marketing', 10, 'Marketing — required', 'all', 12,
   '[{"code":"MARK 301","title":"Marketing Analysis and Decision-Making","credits":3},
     {"code":"MARK 302","title":"Marketing Research","credits":3},
     {"code":"MARK 305","title":"Consumer Behaviour","credits":3},
     {"code":"MARK 495","title":"Advanced Strategic Marketing","credits":3}]'::jsonb,
   null, null),
  ('bcomm-marketing', 11, 'Marketing — 400-level electives', 'credits', 12,
   '[]'::jsonb,
   '12 credits of additional 400-level MARK courses offered by the Department.',
   '{"subject":"MARK","min_catalog":400}'::jsonb);

-- The degree-level "Major" placeholder is replaced by the real thing for anyone
-- who picks a major, so its wording now says where to look.
update public.program_groups
   set rule = 'Twenty-four credits from one of the majors offered by the School of Business. Pick your major to see its actual course list.'
 where program_id = 'bcomm' and title = 'Major';

-- Check:
--   select p.id, p.parent_id, count(g.*) as groups
--     from public.programs p
--     left join public.program_groups g on g.program_id = p.id
--    group by p.id, p.parent_id order by p.parent_id nulls first, p.id;
