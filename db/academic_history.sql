-- ── Academic history: past semesters + archived courses ──────────────────────
-- Courses already carry a `term`. This adds the "is this term over" flag plus a
-- FROZEN final grade, so past-term GPA is stable and can never drift if an old
-- assessment is edited later.
--
--   • archived      — false = a course in your current term, true = a past one.
--   • final_percent — the grade snapshot taken when the course was archived, or
--                     typed directly for a course from BEFORE you used the app
--                     (transcript-style entry: code + credits + final grade, no
--                     assessments needed).
--   • final_letter  — the letter shown on the transcript (derived on entry).
--
-- RUN in the Supabase SQL editor. Safe to re-run.

alter table public.courses
  add column if not exists archived      boolean not null default false,
  add column if not exists final_percent numeric,
  add column if not exists final_letter  text;

-- Fast "my past courses, newest term first" reads.
create index if not exists courses_user_archived_idx
  on public.courses (user_id, archived);
