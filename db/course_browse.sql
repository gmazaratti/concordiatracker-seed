-- ============================================================================
-- Browsing the catalogue without searching first.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
-- Requires db/course_catalog.sql.
--
-- The course directory and the seat picker both opened on an empty box, which
-- makes a working feature look broken and gives a student nothing to react to.
-- This is the "show me something" query: a page of courses, optionally narrowed
-- to the subjects a student actually studies, with a total so a Load more
-- button knows when to stop.
-- ============================================================================

create or replace function public.browse_courses(
  p_subjects text[] default null,
  p_offset   int    default 0,
  p_limit    int    default 10
)
returns table (
  id text, subject text, catalog text, title text,
  career text, class_unit numeric, prerequisites text,
  total_count bigint
)
language sql security definer set search_path = public stable as $$
  with matched as (
    select c.*
    from public.course_catalog c
    -- NULL or an empty array means "no filter", so one function serves both the
    -- personalised list and the general one.
    where p_subjects is null
       or cardinality(p_subjects) = 0
       or c.subject = any (p_subjects)
  )
  select m.id, m.subject, m.catalog, m.title, m.career, m.class_unit, m.prerequisites,
         count(*) over () as total_count
  from matched m
  order by m.subject, m.catalog
  offset greatest(0, coalesce(p_offset, 0))
  limit  greatest(1, least(coalesce(p_limit, 10), 400));
$$;
grant execute on function public.browse_courses(text[], int, int) to anon, authenticated;

/**
 * The subjects a student has actually touched, most-used first.
 *
 * Drives the default list: someone in Computer Science should not have to
 * search to be shown COMP courses. Reads their own rows only, which RLS would
 * enforce anyway; SECURITY DEFINER is here for the same reason as
 * course_tracking, and it returns subjects, never courses or identities.
 */
create or replace function public.my_subjects()
returns table (subject text, n int)
language sql security definer set search_path = public stable as $$
  select upper(substring(trim(c.code) from '^[A-Za-z]{2,6}')) as subject,
         count(*)::int as n
  from public.courses c
  where c.user_id = auth.uid()
    and trim(coalesce(c.code, '')) <> ''
  group by 1
  having upper(substring(trim(c.code) from '^[A-Za-z]{2,6}')) is not null
  order by 2 desc, 1;
$$;
grant execute on function public.my_subjects() to authenticated;
