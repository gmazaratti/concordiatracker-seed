-- ─────────────────────────────────────────────────────────────────────────────
-- Data reports + enrolment status.
--
-- Three things that belong together because they are all "the data we show is
-- not the data the student is looking at in the portal":
--
--   1. courses.enrollment  — registered / waitlisted / planned.
--   2. data_reports        — "this is wrong" and "my course is missing",
--                            surfaced in the admin console so it can be checked
--                            against Concordia rather than trusted or ignored.
--   3. a cleanup of demo announcements that are attaching themselves to real
--      students' real courses.
--
-- Run this in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Enrolment status ──────────────────────────────────────────────────────
-- Nullable, and null means "registered". A course you added is one you are in
-- until you say otherwise, so the common case costs no clicks and no backfill.
alter table public.courses add column if not exists enrollment text;

do $$ begin
  alter table public.courses
    add constraint courses_enrollment_check
    check (enrollment is null or enrollment in ('registered', 'waitlisted', 'planned'));
exception when duplicate_object then null; end $$;

-- ── 2. Data reports ──────────────────────────────────────────────────────────
create table if not exists public.data_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  -- What KIND of wrongness. Kept as a column rather than inferred from which
  -- fields are filled, so the admin queue can be filtered without guessing.
  kind         text not null check (kind in ('course_info', 'missing_course', 'section')),
  -- The course this is about, normalised ("COMP 248"). Nullable for a report
  -- that is not about a course at all.
  course_code  text,
  course_id    uuid references public.courses(id) on delete set null,
  -- The specific field, when the report is about one ("meetingTimes", "credits").
  field        text,
  current_value text,
  suggested_value text,
  note         text,
  -- Everything else the form collected. jsonb for the same reason `translations`
  -- is: a new field on the missing-course form must not be a migration.
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'open'
                 check (status in ('open', 'reviewed', 'applied', 'dismissed')),
  admin_notes  text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists data_reports_status_idx  on public.data_reports (status, created_at desc);
create index if not exists data_reports_code_idx    on public.data_reports (course_code);

alter table public.data_reports enable row level security;

-- A student may file a report and read their own back. They may NOT update one:
-- status is the admin's word on it, not the reporter's.
drop policy if exists data_reports_insert_own on public.data_reports;
create policy data_reports_insert_own on public.data_reports
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists data_reports_select_own on public.data_reports;
create policy data_reports_select_own on public.data_reports
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists data_reports_admin_update on public.data_reports;
create policy data_reports_admin_update on public.data_reports
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Admin read joins the reporter's email, which RLS on user_profile would
-- otherwise hide, so it goes through a definer function like the other queues.
create or replace function public.admin_list_data_reports()
returns table (
  id uuid, user_email text, kind text, course_code text, field text,
  current_value text, suggested_value text, note text, payload jsonb,
  status text, admin_notes text, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select r.id, u.email::text, r.kind, r.course_code, r.field,
           r.current_value, r.suggested_value, r.note, r.payload,
           r.status, r.admin_notes, r.created_at
    from public.data_reports r
    left join auth.users u on u.id = r.user_id
    order by (r.status = 'open') desc, r.created_at desc;
end $$;

create or replace function public.admin_update_data_report(
  p_id uuid, p_status text, p_notes text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.data_reports
     set status = p_status,
         admin_notes = nullif(p_notes, ''),
         resolved_at = case when p_status in ('applied', 'dismissed') then now() else null end
   where id = p_id;
end $$;

revoke all on function public.admin_list_data_reports() from public, anon;
revoke all on function public.admin_update_data_report(uuid, text, text) from public, anon;
grant execute on function public.admin_list_data_reports() to authenticated;
grant execute on function public.admin_update_data_report(uuid, text, text) to authenticated;

-- ── 3. Demo announcements ────────────────────────────────────────────────────
-- These were seeded in db/phase9_teacher.sql to make the teacher portal
-- demonstrable. They match by course CODE, so the moment a real student added
-- FINA 210 they inherited "Term project groups due Friday" from a professor who
-- never posted it. Two obvious test rows came along the same way.
--
-- Look before deleting:
--   select course_code, author_name, title from public.announcements;
delete from public.announcements
 where course_code in ('FAKE 209')
    or (course_code, title) in (
      ('COMM 217', 'Midterm coverage posted'),
      ('FINA 210', 'Term project groups due Friday'),
      ('ECON 203', 'Lab 2 deadline reminder'),
      ('COMP 248', 'Assignment 2 deadline extended'),
      ('MATH 205', 'Office hours moved to Thursday'),
      ('POLI 202', 'Guest lecture on Quebec federalism')
    );
