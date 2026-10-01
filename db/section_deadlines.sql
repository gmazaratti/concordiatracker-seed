-- Registration / refund (DNE) / withdrawal (DISC) deadlines, per section.
--
-- Mirrored daily from the registrar's "Term dates and deadlines" page by
-- api/_sync-deadlines.ts (parser: api/_deadlines-parse.ts). Two kinds of row:
--   standard — one per session; every ordinary section follows these
--   section  — the non-standard sections the page lists one by one
-- The app matches a student's course (code + section + term) to a section row
-- first and falls back to the standard row for that term.
--
-- PUBLIC DATA, PUBLIC READ: the registrar publishes all of it. There is no
-- write policy at all; only the service role (the sync) writes.
--
-- Idempotent: safe to re-run.

create table if not exists public.section_deadlines (
  term_code        text not null,
  kind             text not null check (kind in ('standard', 'section')),
  subject          text not null default '',
  catalog          text not null default '',
  section          text not null default '',
  session          text not null default '',
  section_prefixes text[],
  start_date       date,
  end_date         date,
  registration     date,
  dne              date,
  disc             date,
  synced_at        timestamptz not null default now(),
  primary key (term_code, kind, subject, catalog, section, session)
);

create index if not exists section_deadlines_course_idx
  on public.section_deadlines (subject, catalog, term_code);

alter table public.section_deadlines enable row level security;

drop policy if exists section_deadlines_read on public.section_deadlines;
create policy section_deadlines_read on public.section_deadlines
  for select to anon, authenticated using (true);

grant select on public.section_deadlines to anon, authenticated;
