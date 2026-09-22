-- A local mirror of Concordia's section schedule, one whole term at a time.
--
-- WHY THIS EXISTS. We were reading sections straight off Concordia with
-- `course/schedule/filter/*/{subject}/{catalog}` — one request per course,
-- live, on the student's click. Two things were wrong with that:
--
--   1. IT IS A ROLLING WINDOW. That endpoint returns whatever four-ish terms
--      Concordia happens to be serving, and when a term rolls off, it is gone
--      for us. concordia.courses still shows Summer 2026 for exactly this
--      reason: they kept a copy and we did not.
--   2. IT IS ONE COURSE PER CALL. Building a timetable means dozens of round
--      trips to somebody else's server while a student waits.
--
-- `course/scheduleTerm/filter/{subject}/{termcode}` returns an ENTIRE SUBJECT
-- for a NAMED TERM in one request — 359 rows for COMP in ~1.8s, measured. 277
-- subjects covers the whole university in about eight minutes of wall clock,
-- run on a schedule instead of on a click. (Credit where it is due: this
-- endpoint was found by reading concordia.courses' source.)
--
-- THE PAYLOAD IS A SUPERSET of what the other endpoint gives, so nothing that
-- reads sections loses a field. It adds `classStartDate`/`classEndDate`,
-- `session`, `career` and the faculty/department names.
--
-- WE STORE WHAT CONCORDIA SAID AND WHEN. `synced_at` is on every row, and the
-- UI is expected to show it: seat counts go stale in minutes during
-- registration, and a number with no timestamp beside it is a number somebody
-- will act on an hour after it stopped being true.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create table if not exists public.course_sections (
  -- THE KEY IS THREE PARTS, and the third one is not optional.
  -- A class number is NOT unique within a term: a class with several meeting
  -- patterns repeats it once per pattern (AERO 2254 has one lab emitting five
  -- rows under class number 1046). Keying on the pair made every upsert fail
  -- with "ON CONFLICT DO UPDATE command cannot affect row a second time",
  -- because one statement tried to write the same row five times.
  term_code    text not null,
  class_number text not null,
  meeting_pattern_number integer not null default 1,
  subject      text not null,
  catalog      text not null,
  course_title text,
  section      text,
  component_code text,
  component_description text,
  session      text,
  career       text,
  -- Seats. The whole reason anyone looks at this table.
  enrollment_capacity  integer,
  current_enrollment   integer,
  waitlist_capacity    integer,
  current_waitlist     integer,
  has_seat_reserved    boolean,
  class_status text,
  -- When and where.
  class_start_time text,
  class_end_time   text,
  class_start_date date,
  class_end_date   date,
  mondays boolean, tuesdays boolean, wednesdays boolean, thursdays boolean,
  fridays boolean, saturdays boolean, sundays boolean,
  location_code text,
  building_code text,
  room text,
  instruction_mode_description text,
  department_description text,
  faculty_description text,
  synced_at timestamptz not null default now(),
  primary key (term_code, class_number, meeting_pattern_number)
);

create index if not exists course_sections_code_idx
  on public.course_sections (subject, catalog, term_code);
create index if not exists course_sections_term_idx
  on public.course_sections (term_code);
-- Seat watching reads open sections; the partial index keeps that cheap.
create index if not exists course_sections_open_idx
  on public.course_sections (term_code, subject)
  where current_enrollment < enrollment_capacity;

alter table public.course_sections enable row level security;

-- Public course data. Read by anyone, written only by the sync job (service
-- role bypasses RLS), so there is deliberately no insert or update policy.
drop policy if exists course_sections_read on public.course_sections;
create policy course_sections_read on public.course_sections
  for select to anon, authenticated using (true);

-- ── The sync ledger ─────────────────────────────────────────────────────────
-- One row per (subject, term). The job picks the stalest and works through
-- them, so a run that times out halfway resumes rather than starting over —
-- the same shape as `outline_sources`, and the lesson from the catalogue sync
-- that once wrote 1,946 of 7,946 rows and reported success.
create table if not exists public.section_sync_state (
  subject    text not null,
  term_code  text not null,
  rows       integer not null default 0,
  status     text not null default 'pending',   -- pending | ok | empty | error
  error      text,
  synced_at  timestamptz,
  primary key (subject, term_code)
);
alter table public.section_sync_state enable row level security;
drop policy if exists section_sync_state_read on public.section_sync_state;
create policy section_sync_state_read on public.section_sync_state
  for select to authenticated using (public.is_admin());

/** How fresh is the mirror, and how much of it landed. */
create or replace function public.section_sync_report()
returns table (
  term_code text,
  subjects  integer,
  sections  integer,
  oldest    timestamptz,
  newest    timestamptz,
  errors    integer
)
language sql stable security definer set search_path = public as $$
  select s.term_code,
         count(distinct s.subject)::int,
         count(*)::int,
         min(s.synced_at),
         max(s.synced_at),
         (select count(*)::int from public.section_sync_state e
           where e.term_code = s.term_code and e.status = 'error')
    from public.course_sections s
   group by s.term_code
   order by s.term_code desc;
$$;
grant execute on function public.section_sync_report() to anon, authenticated;

/**
 * Sections for one course, newest term first.
 *
 * Replaces a live call to Concordia per course. Returns `synced_at` so the
 * caller can say how old the seat counts are rather than implying they are
 * live.
 */
-- IDENTICAL PATTERNS ARE COLLAPSED ON READ, not on write. Concordia emits
-- five rows for one lab that meets once; storing only the first would be us
-- deciding their data is wrong, and we would lose the genuine case (a class
-- that meets Monday morning AND Wednesday afternoon is two real patterns).
-- So everything is stored, and the reader returns one row per DISTINCT
-- meeting.
create or replace function public.course_sections_for(p_code text, p_term text default null)
returns setof public.course_sections
language sql stable security definer set search_path = public as $$
  select distinct on (
           s.term_code, s.class_number, s.component_code, s.section,
           s.class_start_time, s.class_end_time,
           s.mondays, s.tuesdays, s.wednesdays, s.thursdays,
           s.fridays, s.saturdays, s.sundays, s.room
         ) s.*
    from public.course_sections s
   where public.ct_norm_code(s.subject || ' ' || s.catalog) = public.ct_norm_code(p_code)
     and (p_term is null or s.term_code = p_term)
   order by s.term_code, s.class_number, s.component_code, s.section,
            s.class_start_time, s.class_end_time,
            s.mondays, s.tuesdays, s.wednesdays, s.thursdays,
            s.fridays, s.saturdays, s.sundays, s.room,
            s.meeting_pattern_number;
$$;
grant execute on function public.course_sections_for(text, text) to anon, authenticated;

/**
 * Every subject in the catalogue.
 *
 * A FUNCTION, not a client-side `select distinct`. PostgREST caps a plain
 * select at 1000 rows by default, and `course_catalog` holds 7,884 — so the
 * first version of the sync job read one page, saw 32 distinct subjects and
 * reported a clean run over an eighth of the university. A count that looks
 * plausible is the worst kind of wrong.
 */
create or replace function public.catalog_subjects()
returns setof text
language sql stable security definer set search_path = public as $$
  select distinct upper(subject) from public.course_catalog
   where subject is not null and btrim(subject) <> ''
   order by 1;
$$;
grant execute on function public.catalog_subjects() to anon, authenticated;
