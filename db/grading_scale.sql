-- The class's grading scale (letter-grade cutoffs), if the syllabus stated one.
-- Populated by the AI syllabus parser. Deploy-safe: writes go through the
-- optimistic, non-fatal updateCourse path, so a missing column only means the
-- scale isn't persisted until this runs — nothing breaks. Run whenever.
alter table public.courses
  add column if not exists grading_scale text;
