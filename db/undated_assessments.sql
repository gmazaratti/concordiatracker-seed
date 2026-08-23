-- ─────────────────────────────────────────────────────────────────────────────
-- Assessments with no date yet.
--
-- A syllabus that says "final exam: TBA, scheduled by the registrar" is stating
-- a fact. Requiring a date to save the row forced students to invent one, and an
-- invented deadline is worse than no deadline because it gets planned around.
--
-- Run this in the Supabase SQL editor (project qagtygymiivnyfwrtmzl).
-- ─────────────────────────────────────────────────────────────────────────────

-- The only change. Everything else is application logic.
alter table public.assignments alter column date drop not null;

-- Nothing existing is affected: every current row has a date, and null is only
-- ever written from now on by someone choosing "No date yet".
--
-- Check afterwards:
--   select count(*) filter (where date is null) as undated,
--          count(*)                             as total
--   from public.assignments;
