-- Personal quick links on a course (the homework portal, a lab site, a
-- WileyPLUS assignments page). db/course_quick_links.sql. Idempotent.
--
-- On the student's OWN course row, so the existing select-own / update-own
-- policies on `courses` already make them private: nobody else sees them, and
-- nothing about them is shared through outlines or blueprints.
-- Shape: [{"label": "WileyPLUS", "url": "https://..."}], at most 12.
alter table public.courses add column if not exists quick_links jsonb not null default '[]'::jsonb;
alter table public.courses drop constraint if exists courses_quick_links_shape;
alter table public.courses add constraint courses_quick_links_shape
  check (jsonb_typeof(quick_links) = 'array' and jsonb_array_length(quick_links) <= 12);
