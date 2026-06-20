-- A richer per-assessment description, populated by the AI syllabus parser
-- (distinct from the user's free-form `notes`). Deploy-safe: the app retries
-- inserts without this column if it isn't present yet, so there's no hard
-- ordering — run it whenever.
alter table public.assignments
  add column if not exists description text;
