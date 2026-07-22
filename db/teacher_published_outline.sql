-- ── Teacher: draft assignments vs shared outline ─────────────────────────────
-- Teachers now edit "assignments" (the working outline) freely; the SHARED
-- outline (the blueprint students import) is a snapshot they explicitly publish.
-- This column stores that published snapshot so "you have unpublished changes" is
-- accurate across reloads. (`outline` stays the working draft.)
--
-- RUN AFTER db/phase9_teacher_courses.sql. Safe to re-run.

alter table public.teacher_courses
  add column if not exists published_outline jsonb;

-- Backfill: existing published courses treat their current outline as the shared
-- one (they had no separate draft before this change).
update public.teacher_courses
   set published_outline = outline
 where published = true and published_outline is null;
