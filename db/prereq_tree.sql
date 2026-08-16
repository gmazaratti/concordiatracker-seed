-- ============================================================================
-- The prerequisite tree: what a course needs, and what it opens up.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
-- Requires db/course_catalog.sql and db/seat_alerts_and_tracking.sql.
-- ============================================================================

/**
 * Catalogue rows for a set of codes, in one round trip.
 *
 * Walking a prerequisite chain means fetching a whole LEVEL at a time - the
 * three courses this one needs, then everything those three need. Doing it one
 * course at a time would be a request per node and a visibly slow tree.
 */
create or replace function public.courses_by_codes(p_codes text[])
returns table (
  id text, subject text, catalog text, title text,
  class_unit numeric, prerequisites text
)
language sql security definer set search_path = public stable as $$
  with wanted as (
    select distinct public.ct_norm_code(c) as code
    from unnest(coalesce(p_codes, '{}'::text[])) c
  )
  select c.id, c.subject, c.catalog, c.title, c.class_unit, c.prerequisites
  from public.course_catalog c
  join wanted w on w.code = public.ct_norm_code(c.subject || c.catalog)
  order by c.subject, c.catalog;
$$;
grant execute on function public.courses_by_codes(text[]) to anon, authenticated;

/**
 * Courses that name this one in their prerequisites.
 *
 * The forward direction: "what does finishing COMP 248 open up". Matched on the
 * extracted codes rather than on the raw text, so "COMP 2480" never counts as a
 * mention of "COMP 248".
 */
create or replace function public.unlocked_by(p_code text, p_limit int default 60)
returns table (
  id text, subject text, catalog text, title text,
  class_unit numeric, prerequisites text
)
language sql security definer set search_path = public stable as $$
  select c.id, c.subject, c.catalog, c.title, c.class_unit, c.prerequisites
  from public.course_catalog c
  where coalesce(c.prerequisites, '') <> ''
    and public.ct_norm_code(p_code) = any (public.prereq_codes(c.prerequisites))
    -- A course never unlocks itself, however the text is written.
    and public.ct_norm_code(c.subject || c.catalog) <> public.ct_norm_code(p_code)
  order by c.subject, c.catalog
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;
grant execute on function public.unlocked_by(text, int) to anon, authenticated;

-- prereq_codes() is called once per row by the scan above, so it earns an index
-- on the expression rather than being recomputed across the whole catalogue.
create index if not exists course_catalog_prereq_codes_idx
  on public.course_catalog using gin (public.prereq_codes(prerequisites));
