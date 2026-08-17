-- ============================================================================
-- Degree requirements, per programme.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- WHY THIS IS CURATED AND NOT SCRAPED
--
-- Concordia publishes no API for programme requirements — opendata.concordia.ca
-- documents Courses and Library, and nothing else. The requirements live in the
-- undergraduate calendar, one page per programme, and they split cleanly in two:
--
--   * Core lists are exact and machine-readable: "COMP 232 Mathematics for
--     Computer Science (3.00)". These we tick off precisely.
--   * Electives are prose with conditionals: "chosen from", "300-level or
--     above", "cannot receive credit for both COMP 339 and MATH 339", exclusion
--     lists 25 items long. A scraper that half-understood those would tell a
--     student they had finished a degree they had not, which is the single most
--     damaging thing this product could do.
--
-- So every row here is entered by hand from the calendar, carries the URL it
-- came from and the calendar year it belongs to, and an elective group stores
-- the calendar's WORDING rather than a rule we invented. The UI shows that
-- wording verbatim and counts only what it can count.
-- ============================================================================

create table if not exists public.programs (
  id            text primary key,
  name          text not null,
  faculty       text not null,
  degree        text not null,
  total_credits numeric not null,
  /** Which calendar this was transcribed from, so staleness is visible. */
  calendar_year text not null,
  /** The exact page a student can check us against. */
  source_url    text not null,
  updated_at    timestamptz not null default now()
);

create table if not exists public.program_groups (
  id         uuid primary key default gen_random_uuid(),
  program_id text not null references public.programs (id) on delete cascade,
  position   int  not null,
  title      text not null,
  /**
   * 'all'     — every course listed is required. Ticked off exactly.
   * 'credits' — N credits chosen under a rule we do not parse. Shown, counted
   *             only against the student's unassigned credits, never asserted.
   */
  kind       text not null check (kind in ('all', 'credits')),
  credits    numeric not null,
  /** [{code, title, credits}] for an 'all' group; empty for a 'credits' one. */
  courses    jsonb not null default '[]'::jsonb,
  /** The calendar's own words, for an elective group. Displayed verbatim. */
  rule       text,
  note       text,
  unique (program_id, position)
);

create index if not exists program_groups_program_idx
  on public.program_groups (program_id, position);

-- Published calendar data: readable by anyone, writable by nobody through the
-- API. Curation happens here, in SQL, on purpose.
alter table public.programs        enable row level security;
alter table public.program_groups  enable row level security;

drop policy if exists programs_read on public.programs;
create policy programs_read on public.programs for select using (true);

drop policy if exists program_groups_read on public.program_groups;
create policy program_groups_read on public.program_groups for select using (true);

grant select on public.programs, public.program_groups to anon, authenticated;

-- ── Which programme a student says they are in ──────────────────────────────
-- On user_profile rather than a table of its own: it is one nullable string per
-- person, and it belongs with school/program which already live there.
alter table public.user_profile
  add column if not exists program_id text references public.programs (id);

-- ============================================================================
-- SEED — two programmes, transcribed from the 2026-2027 calendar.
-- ============================================================================

insert into public.programs (id, name, faculty, degree, total_credits, calendar_year, source_url)
values
  (
    'bcompsc',
    'Computer Science',
    'Gina Cody School of Engineering and Computer Science',
    'BCompSc',
    90,
    '2026-2027',
    'https://www.concordia.ca/academics/undergraduate/calendar/current/section-71-gina-cody-school-of-engineering-and-computer-science/section-71-70-department-of-computer-science-and-software-engineering/section-71-70-2-degree-requirements-bcompsc-.html'
  ),
  (
    'bcomm',
    'Commerce',
    'John Molson School of Business',
    'BComm',
    90,
    '2026-2027',
    'https://www.concordia.ca/academics/undergraduate/calendar/current/section-61-john-molson-school-of-business/section-61-22-the-jmsb-core.html'
  )
on conflict (id) do update
  set name = excluded.name,
      faculty = excluded.faculty,
      degree = excluded.degree,
      total_credits = excluded.total_credits,
      calendar_year = excluded.calendar_year,
      source_url = excluded.source_url,
      updated_at = now();

-- Re-runnable: groups are rebuilt wholesale rather than merged, so a correction
-- to the calendar is one edit here and not a hunt for the row that changed.
delete from public.program_groups where program_id in ('bcompsc', 'bcomm');

-- ── BCompSc ─────────────────────────────────────────────────────────────────
insert into public.program_groups (program_id, position, title, kind, credits, courses, rule, note) values
  ('bcompsc', 1, 'Computer Science Core', 'all', 33, '[
    {"code":"COMP 228","title":"System Hardware","credits":3},
    {"code":"COMP 232","title":"Mathematics for Computer Science","credits":3},
    {"code":"COMP 233","title":"Probability and Statistics for Computer Science","credits":3},
    {"code":"COMP 248","title":"Object-Oriented Programming I","credits":3.5},
    {"code":"COMP 249","title":"Object-Oriented Programming II","credits":3.5},
    {"code":"COMP 335","title":"Introduction to Theoretical Computer Science","credits":3},
    {"code":"COMP 346","title":"Operating Systems","credits":4},
    {"code":"COMP 348","title":"Principles of Programming Languages","credits":3},
    {"code":"COMP 352","title":"Data Structures and Algorithms","credits":3},
    {"code":"COMP 354","title":"Introduction to Software Engineering","credits":4}
  ]'::jsonb, null, null),

  ('bcompsc', 2, 'Computer Science Complementary Core', 'all', 6, '[
    {"code":"ENCS 282","title":"Technical Writing and Communication","credits":3},
    {"code":"ENCS 393","title":"Social and Ethical Dimensions of Information and Communication Technologies","credits":3}
  ]'::jsonb, null, null),

  ('bcompsc', 3, 'Artificial Intelligence Electives', 'credits', 4, '[]'::jsonb,
   'Chosen from the Artificial Intelligence elective list in the calendar.',
   'The calendar names the eligible courses with conditions we do not parse — check the list on the source page.'),

  ('bcompsc', 4, 'Computer Science Electives', 'credits', 14, '[]'::jsonb,
   'Chosen from Computer Science courses at the 300 level or above, subject to the calendar''s exclusions (for example, credit cannot be received for both COMP 339 and MATH 339).',
   'Exclusions run to more than twenty pairs. Confirm with an advisor before relying on a course counting here.'),

  ('bcompsc', 5, 'Mathematics Electives', 'credits', 6, '[]'::jsonb,
   'Chosen from the Mathematics elective list for the BCompSc.', null),

  ('bcompsc', 6, 'Minor or General Electives', 'credits', 27, '[]'::jsonb,
   'Minor electives or general electives, as set out for the BCompSc.', null);

-- ── BComm (JMSB Core) ───────────────────────────────────────────────────────
insert into public.program_groups (program_id, position, title, kind, credits, courses, rule, note) values
  ('bcomm', 1, 'JMSB Core — 200 level', 'all', 34.5, '[
    {"code":"COMM 205","title":"Business Communication","credits":3},
    {"code":"COMM 211","title":"Global Business Environment","credits":3},
    {"code":"COMM 213","title":"Computing and Visualization Tools for Business Analytics","credits":1.5},
    {"code":"COMM 214","title":"Business Analytics","credits":3},
    {"code":"COMM 216","title":"Ethics, Business Sustainability, and Social Responsibility","credits":1.5},
    {"code":"COMM 217","title":"Financial Accounting","credits":3},
    {"code":"COMM 219","title":"Innovation Management","credits":1.5},
    {"code":"COMM 221","title":"Financial Markets","credits":3},
    {"code":"COMM 223","title":"Marketing Management","credits":3},
    {"code":"COMM 225","title":"Production and Operations Management","credits":3},
    {"code":"COMM 226","title":"Business Technology Management","credits":3},
    {"code":"COMM 227","title":"Interpersonal and Critical Thinking Skills","credits":3},
    {"code":"COMM 229","title":"Managing People in Organizations","credits":3}
  ]'::jsonb, null, 'The 48-credit core applies to students admitted in fall 2023 and later. Earlier cohorts followed a 42-credit core.'),

  ('bcomm', 2, 'JMSB Core — 300 level', 'all', 10.5, '[
    {"code":"COMM 305","title":"Managerial Accounting","credits":3},
    {"code":"COMM 309","title":"Business Finance","credits":3},
    {"code":"COMM 316","title":"Business Law and Ethics","credits":1.5},
    {"code":"COMM 320","title":"Entrepreneurship","credits":3}
  ]'::jsonb, null, null),

  ('bcomm', 3, 'JMSB Core — 400 level', 'all', 3, '[
    {"code":"COMM 401","title":"Strategic Management","credits":3}
  ]'::jsonb, null, null),

  ('bcomm', 4, 'Major', 'credits', 24, '[]'::jsonb,
   'Twenty-four credits from one of the majors offered by the School of Business.',
   'Which courses count depends on the major you declare.'),

  ('bcomm', 5, 'Electives outside JMSB', 'credits', 6, '[]'::jsonb,
   'Six credits of electives taken outside the John Molson School of Business.', null),

  ('bcomm', 6, 'General electives', 'credits', 12, '[]'::jsonb,
   'Twelve credits of elective courses.', null);
